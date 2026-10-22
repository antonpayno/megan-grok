"""Imagen/foto -> PatternData (Hama o punto de cruz).

Pipeline:
1. Cargar con Pillow (EXIF), limitar tamaño y pasar a RGBA.
2. Simplificar a "dibujo" (bilateral / mean-shift) según ``simplify``.
3. Reducir a la rejilla del patrón con INTER_AREA y máscara de transparencia.
4. Cuantizar en CIELAB (k-means con sobre-muestreo) y mapear a la paleta real.
5. Limpiar: fundir colores residuales, quitar motas y aplanar zonas lisas.
6. Aplicar contorno (alineado a la rejilla) y quitar fondo si se piden.
7. Construir un PatternData con solo los colores usados.

Criterios de calidad (los que se notan en la demo):
- Contornos limpios: el contorno se dibuja sobre los bordes de la propia
  rejilla, no con Canny a otra resolución, así no salen "dientes" de 1 celda.
- Tonos de piel naturales: la cuantización se hace en Lab y las fotos oscuras
  se realzan con CLAHE (luminancia) antes de cuantizar.
- Fondos sin ruido: el filtro de moda solo actúa en zonas lisas (varianza
  local baja), nunca sobre ojos, texto o detalles finos.
- Nada de píxeles sueltos: los componentes conexos menores que el umbral se
  funden con el color mayoritario de su borde.
"""
from __future__ import annotations

import argparse
import io
import sys
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from sklearn.cluster import KMeans

from ..config import MAX_PALETTE_COLORS, MAX_PATTERN_SIDE
from ..schemas import Craft, Palette, PaletteColor, PatternData
from . import color, palettes

MAX_INPUT_SIDE = 1024
MAX_WORK_SIDE = 768
WORK_PIXELS_PER_CELL = 10
MAX_KMEANS_SAMPLE = 8000
BACKGROUND_TOLERANCE = 24.0
BACKGROUND_STEP_TOLERANCE = 6.0
# ΔE mínimo entre dos colores para que se dibuje contorno entre ellos.
# Alto a propósito: solo las fronteras que se ven de verdad (silueta, ojos,
# hocico), no cada cambio de tono dentro del pelaje.
OUTLINE_MIN_DELTA_E = 24.0
# Desviación típica (Lab) por debajo de la cual una zona se considera "lisa".
SMOOTH_STD = 10.0
# Empujón de croma a la piel para que no acabe en cuentas grises.
SKIN_CHROMA_BOOST = 1.15

# Símbolos para la carta de punto de cruz.
# Solo ASCII: se imprimen igual con la DejaVu del servidor y con la Helvetica
# de reserva en Windows (WinAnsi). Ordenados de más a menos distinguibles:
# los colores más usados se quedan con los símbolos más claros.
_SYMBOLS = (
    "X O + / \\ # @ % & = ~ * ? ! $ ^ | < > ( ) [ ] { } "
    "2 3 4 6 7 9 A B C D E F G H J K L M N P Q R S T U V W Y Z "
    "a b d e f g h j k m n p q r s t u v w y z"
).split()


class InvalidImage(ValueError):
    """El archivo no es una imagen que Pillow pueda abrir."""


class PaletteNotFound(LookupError):
    """No existe la paleta pedida."""


def _load_rgba(data: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImage("El archivo no es una imagen válida") from exc

    img = ImageOps.exif_transpose(img)
    img = img.convert("RGBA")

    # Limitar el lado mayor a 1024 px para que el pipeline sea predecible.
    if max(img.size) > MAX_INPUT_SIDE:
        scale = MAX_INPUT_SIDE / max(img.size)
        new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
    return img


def _nearest_palette_grid(rgba: np.ndarray, palette: Palette) -> np.ndarray:
    """Mapea cada píxel al color más cercano de la paleta, sin suavizar.

    Se usa para pixel art pequeño: 1 píxel = 1 celda y ningún filtro posterior.
    """
    pixels = rgba[..., :3].reshape(-1, 3).astype(np.int32)
    palette_rgb = np.array(
        [color.hex_to_rgb(c.hex) for c in palette.colors], dtype=np.int32
    )
    nearest = np.empty(pixels.shape[0], dtype=np.int32)
    block = 4096
    for start in range(0, pixels.shape[0], block):
        chunk = pixels[start:start + block]
        distances = ((chunk[:, None, :] - palette_rgb[None, :, :]) ** 2).sum(axis=2)
        nearest[start:start + block] = distances.argmin(axis=1)
    nearest[rgba[..., 3].reshape(-1) < 128] = -1
    return nearest


def _auto_exposure(rgb: np.ndarray) -> np.ndarray:
    """Realza sombras en fotos oscuras sin tocar el tono (CLAHE en L).

    Una foto de interior o con el sujeto a contraluz se convierte en un patrón
    casi negro; subir la luminancia local devuelve rasgos y tonos de piel
    reconocibles. En fotos ya bien expuestas no hace nada.
    """
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    mean_l = float(lab[..., 0].mean())
    if mean_l >= 62.0:
        return rgb

    clip = 2.0 if mean_l >= 42.0 else 3.0
    lab[..., 0] = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8)).apply(lab[..., 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def _enhance_skin(rgb: np.ndarray) -> np.ndarray:
    """Sube un poco el croma de la piel para que no se vuelva gris.

    En sombra o con luz fría la piel pierde saturación; al cuantizar acaba en
    cuentas grises y la cara deja de "parecer piel". Se detecta la piel en
    YCrCb (barato y estable) y se refuerza solo el croma, nunca la luminancia.
    """
    ycc = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    luma = ycc[..., 0].astype(np.int16)
    cr = ycc[..., 1].astype(np.int16)
    cb = ycc[..., 2].astype(np.int16)
    skin = (cr >= 133) & (cr <= 178) & (cb >= 80) & (cb <= 128) & (luma >= 30) & (luma <= 240)
    if not bool(skin.any()):
        return rgb

    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    chroma = (lab[..., 1:] - 128.0) * SKIN_CHROMA_BOOST
    lab[..., 1:] = np.where(skin[..., None], 128.0 + chroma, lab[..., 1:])
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)


def _simplify(rgb: np.ndarray, level: int) -> np.ndarray:
    """Aplica filtros de simplificación. ``rgb`` es uint8 HxWx3.

    Niveles: 0 = foto fiel, 1 = suave, 2 = dibujo, 3 = cómic.
    """
    if level <= 0:
        return rgb

    src = np.ascontiguousarray(rgb)
    if level == 1:
        out = cv2.bilateralFilter(src, d=7, sigmaColor=60, sigmaSpace=60)
        return _enhance_skin(_auto_exposure(out))

    # Nivel 2 y 3: mean-shift + bilateral (bordes planos, sin gradientes raros).
    # El radio de color no es muy alto: si se pasa, se comen ojos y pómulos.
    spatial = 10 if level == 2 else 16
    color_radius = 26 if level == 2 else 40
    out = cv2.pyrMeanShiftFiltering(src, sp=spatial, sr=color_radius, maxLevel=1)
    out = cv2.bilateralFilter(out, d=7, sigmaColor=70, sigmaSpace=70)
    out = _enhance_skin(_auto_exposure(out))

    return out


def _remove_background(rgb: np.ndarray, empty: np.ndarray) -> np.ndarray:
    """Flood fill desde los bordes para marcar el fondo como vacío.

    Se combinan dos tolerancias: una local (paso a paso, para seguir degradados
    suaves) y una global (ΔE al color de fondo, para no comerse el sujeto).
    Respeta la transparencia que ya traiga la imagen.
    """
    lab = color.srgb_to_lab(rgb / 255.0)
    h, w = empty.shape
    border_mask = np.concatenate(
        [empty[0, :], empty[-1, :], empty[1:-1, 0], empty[1:-1, -1]]
    )
    border_rgb = np.concatenate(
        [lab[0, :, :], lab[-1, :, :], lab[1:-1, 0, :], lab[1:-1, -1, :]], axis=0
    )
    border_rgb = border_rgb[~border_mask]
    if border_rgb.size == 0:
        return empty
    background = np.median(border_rgb, axis=0)

    mask = empty.copy()
    queue: deque[tuple[int, int]] = deque()

    def is_background(y: int, x: int, ref: np.ndarray) -> bool:
        local = float(np.linalg.norm(lab[y, x] - ref))
        if local > BACKGROUND_STEP_TOLERANCE:
            return False
        return float(np.linalg.norm(lab[y, x] - background)) <= BACKGROUND_TOLERANCE

    for x in range(w):
        for y in (0, h - 1):
            if not mask[y, x] and is_background(y, x, background):
                mask[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y, x] and is_background(y, x, background):
                mask[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and is_background(ny, nx, lab[y, x]):
                mask[ny, nx] = True
                queue.append((ny, nx))
    return mask


def _quantize(
    lab: np.ndarray, empty: np.ndarray, palette: Palette, max_colors: int
) -> tuple[np.ndarray, list[int]]:
    """k-means en Lab -> colores de la paleta. Devuelve rejilla local y paleta elegida.

    Se piden más clusters que colores finales (x2) y luego se quedan los que más
    superficie cubren: así el presupuesto de colores se reparte donde importa y
    no se gastan dos colores casi idénticos en la misma zona.
    """
    valid = ~empty
    if not valid.any():
        return np.full(empty.shape, -1, dtype=np.int16), []

    colors = lab[valid]
    unique = np.unique(np.round(colors, 4), axis=0)
    budget = max(1, min(int(max_colors), MAX_PALETTE_COLORS, len(unique)))

    palette_lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(c.hex) for c in palette.colors], dtype=np.float64) / 255.0
    )

    if budget == 1 or len(unique) == 1:
        centers = unique[:1]
        weights = np.array([float(len(colors))])
    else:
        sample = colors
        if len(sample) > MAX_KMEANS_SAMPLE:
            rng = np.random.default_rng(0)
            sample = colors[rng.choice(len(colors), MAX_KMEANS_SAMPLE, replace=False)]
        k = min(int(len(unique)), budget * 2, MAX_PALETTE_COLORS)
        model = KMeans(n_clusters=k, n_init="auto", random_state=0)
        model.fit(sample)
        centers = model.cluster_centers_
        weights = np.bincount(model.labels_, minlength=k).astype(np.float64)

    mapped = color.nearest_palette(centers, palette_lab)
    totals: dict[int, float] = {}
    for index, weight in zip(mapped.tolist(), weights.tolist()):
        totals[int(index)] = totals.get(int(index), 0.0) + float(weight)

    chosen = [i for i, _ in sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))][:budget]
    if not chosen:
        return np.full(empty.shape, -1, dtype=np.int16), []

    chosen_lab = palette_lab[chosen]
    local = color.nearest_palette(colors, chosen_lab)

    grid = np.full(empty.shape, -1, dtype=np.int16)
    grid[valid] = local.astype(np.int16)
    return grid, chosen


def _merge_similar(
    grid: np.ndarray, chosen: list[int], palette_lab: np.ndarray, threshold: float
) -> tuple[np.ndarray, list[int]]:
    """Funde colores de la paleta casi idénticos (ΔE < ``threshold``).

    Sin esto una foto con degradados gasta dos o tres cuentas en tonos que a
    simple vista son el mismo; fundirlos deja el patrón más limpio y libera
    presupuesto de color para lo que sí se distingue.
    """
    while len(chosen) > 1:
        counts = _counts(grid, len(chosen))
        pair: tuple[int, int] | None = None
        best = threshold
        for i in range(len(chosen)):
            for j in range(i + 1, len(chosen)):
                distance = float(np.linalg.norm(palette_lab[i] - palette_lab[j]))
                if distance <= best:
                    best = distance
                    pair = (i, j)
        if pair is None:
            break
        first, second = pair
        # El menos usado se funde con el más usado (empate: el índice mayor).
        if counts[first] > counts[second]:
            first, second = second, first
        grid = np.where(grid == first, second, grid)
        grid = np.where(grid > first, grid - 1, grid)
        chosen = [c for k, c in enumerate(chosen) if k != first]
        palette_lab = np.delete(palette_lab, first, axis=0)
    return grid, chosen


def _counts(grid: np.ndarray, n_colors: int) -> np.ndarray:
    return np.bincount(grid[grid >= 0], minlength=n_colors).astype(np.int64)


def _mode_filter(
    grid: np.ndarray, size: int = 5, iterations: int = 1, mask: np.ndarray | None = None
) -> np.ndarray:
    """Filtro de moda vectorizado sobre la rejilla.

    Con ``mask`` solo reescribe las celdas marcadas: eso permite aplanar fondos
    y piel (zonas lisas) sin borrar ojos, texto o cualquier detalle de 1-2 celdas.
    Las celdas vacías (-1) se conservan siempre.
    """
    if grid.size == 0:
        return grid
    values = [int(c) for c in np.unique(grid[grid >= 0])]
    if len(values) <= 1:
        return grid

    pad = size // 2
    color_values = np.array(values, dtype=np.int16)
    region = np.ones(grid.shape, dtype=bool) if mask is None else mask
    out = grid.copy()

    for _ in range(iterations):
        previous = out
        scores = []
        for value in values:
            onehot = (previous == value).astype(np.float32)
            padded = cv2.copyMakeBorder(onehot, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
            counts = cv2.boxFilter(
                padded, -1, (size, size), normalize=False
            )[pad:-pad, pad:-pad]
            scores.append(counts)
        stack = np.stack(scores, axis=0)
        # Desempate: si el color central empata con el ganador, se queda el central.
        stack += (color_values[:, None, None] == previous[None, :, :]) * 0.5
        best = color_values[np.argmax(stack, axis=0)]
        out = np.where(region & (previous >= 0), best, previous)

    return out


def _despeckle(grid: np.ndarray, min_area: int) -> np.ndarray:
    """Funde componentes conexos de menos de ``min_area`` celdas con su borde.

    Es lo que elimina los "píxeles sueltos": una cuenta rodeada de otro color,
    o una pareja de cuentas perdida en mitad del fondo, pasa a ser del color
    mayoritario que la rodea.

    Los componentes se calculan color a color porque OpenCV solo etiqueta
    imágenes binarias (8 bits): pasarle la rejilla entera juntaría todos los
    colores en un mismo componente.
    """
    if grid.size == 0 or min_area <= 1:
        return grid

    height, width = grid.shape
    out = grid.copy()
    for value in np.unique(grid[grid >= 0]).tolist():
        mask = (grid == value).astype(np.uint8)
        label_count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
        for label in range(1, label_count):
            if stats[label, cv2.CC_STAT_AREA] >= min_area:
                continue
            component = labels == label
            neighbours: dict[int, int] = {}
            ys, xs = np.nonzero(component)
            for y, x in zip(ys.tolist(), xs.tolist()):
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < height and 0 <= nx < width and not component[ny, nx]:
                        other = int(grid[ny, nx])
                        if other >= 0:
                            neighbours[other] = neighbours.get(other, 0) + 1
            if not neighbours:
                continue
            # Vecino mayoritario (desempate: el índice más pequeño, determinista).
            best = max(neighbours, key=lambda key: (neighbours[key], -key))
            out[component] = best

    return out


def _smooth_mask(lab: np.ndarray, threshold: float = SMOOTH_STD) -> np.ndarray:
    """Celdas cuya vecindad 3x3 es "lisa" (varianza Lab baja)."""
    pad = 1
    padded = cv2.copyMakeBorder(
        lab.astype(np.float32), pad, pad, pad, pad, cv2.BORDER_REPLICATE
    )
    mean = cv2.boxFilter(padded, -1, (3, 3), normalize=True)[pad:-pad, pad:-pad]
    mean_sq = cv2.boxFilter(padded * padded, -1, (3, 3), normalize=True)[pad:-pad, pad:-pad]
    variance = np.clip(mean_sq - mean * mean, 0.0, None).sum(axis=-1)
    return np.sqrt(variance) < threshold


def _has_same_neighbour(grid: np.ndarray) -> np.ndarray:
    """True en las celdas que comparten color con algún vecino-4."""
    same = np.zeros(grid.shape, dtype=bool)
    same[:, :-1] |= grid[:, :-1] == grid[:, 1:]
    same[:, 1:] |= grid[:, 1:] == grid[:, :-1]
    same[:-1, :] |= grid[:-1, :] == grid[1:, :]
    same[1:, :] |= grid[1:, :] == grid[:-1, :]
    return same & (grid >= 0)


def _remove_isolated(grid: np.ndarray, passes: int = 2) -> np.ndarray:
    """Funde celdas sin ningún vecino-4 de su color con la moda de sus vecinas.

    Es la red de seguridad contra el "sal y pimienta": tramas de rayas finas o
    ruido de JPEG que se convierten en cuentas sueltas imposibles de seguir en
    una carta impresa.
    """
    for _ in range(max(1, passes)):
        lonely = ~_has_same_neighbour(grid) & (grid >= 0)
        if not lonely.any():
            break
        height, width = grid.shape
        updated = grid.copy()
        ys, xs = np.nonzero(lonely)
        for y, x in zip(ys.tolist(), xs.tolist()):
            neighbours: dict[int, int] = {}
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < height and 0 <= nx < width and grid[ny, nx] >= 0:
                    value = int(grid[ny, nx])
                    neighbours[value] = neighbours.get(value, 0) + 1
            if neighbours:
                updated[y, x] = max(neighbours, key=lambda key: (neighbours[key], -key))
        if np.array_equal(updated, grid):
            break
        grid = updated
    return grid


def _compact(grid: np.ndarray, keep: list[int]) -> np.ndarray:
    """Reindexa los colores locales conservando solo los índices de ``keep``."""
    remap = {old: new for new, old in enumerate(keep)}
    out = np.full(grid.shape, -1, dtype=np.int16)
    for old, new in remap.items():
        out[grid == old] = new
    return out


def _cleanup(
    grid: np.ndarray,
    chosen: list[int],
    palette: Palette,
    simplify: int,
    lab: np.ndarray,
) -> tuple[np.ndarray, list[int]]:
    """Funde colores residuales, quita motas y aplana zonas lisas."""
    if not chosen:
        return grid, chosen

    n = len(chosen)
    palette_lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(palette.colors[i].hex) for i in chosen], dtype=np.float64)
        / 255.0
    )

    # 1) Colores con menos del 0.5 % de las celdas: se funden con el más cercano
    #    (un color que solo aparece en 3 celdas sueltas no merece una cuenta).
    if simplify >= 1 and n > 1:
        while n > 1:
            counts = _counts(grid, n)
            total = int(counts.sum())
            if total == 0:
                break
            fractions = counts / total
            smallest = int(np.argmin(fractions))
            if fractions[smallest] >= 0.005:
                break
            keep = [i for i in range(n) if i != smallest]
            distances = np.linalg.norm(palette_lab[keep] - palette_lab[smallest], axis=1)
            replacement = keep[int(np.argmin(distances))]
            grid = np.where(grid == smallest, replacement, grid)
            grid = np.where(grid > smallest, grid - 1, grid)
            chosen = [c for i, c in enumerate(chosen) if i != smallest]
            palette_lab = np.delete(palette_lab, smallest, axis=0)
            n -= 1

    # 2) Casi duplicados: dos colores que a la vista son el mismo se funden.
    if simplify >= 1 and n > 1:
        palette_lab = color.srgb_to_lab(
            np.array(
                [color.hex_to_rgb(palette.colors[i].hex) for i in chosen], dtype=np.float64
            )
            / 255.0
        )
        merge_threshold = (0.0, 4.0, 6.0, 8.0)[simplify]
        grid, chosen = _merge_similar(grid, chosen, palette_lab, merge_threshold)
        n = len(chosen)

    # 3) Motas: en "foto" y "suave" manda el detalle (un brillo de 1 celda en
    #    un ojo es información); en "dibujo"/"cómic" se limpian las sueltas.
    min_area = (0, 1, 2, 3)[simplify]
    if min_area > 1:
        grid = _despeckle(grid, min_area)

    # 4) Aplanado selectivo: solo en zonas lisas y nunca junto a transparencias.
    #    Si la imagen es casi toda textura (rayas, ruido, trama), no hay "zonas
    #    lisas" que proteger y se aplana entera: a esta resolución no se puede
    #    representar y solo genera cuentas sueltas.
    if simplify >= 1 and n > 1:
        size = 3 if simplify == 1 else 5
        iterations = 1 if simplify <= 2 else 2
        smooth = _smooth_mask(lab)
        kernel = np.ones((size, size), dtype=np.uint8)
        near_empty = cv2.dilate((grid < 0).astype(np.uint8), kernel) > 0
        if float(smooth.mean()) < 0.15:
            # Imagen casi sin zonas lisas (tramas, rayas, ruido puro): ventana
            # más grande y dos pasadas. Los umbrales se eligen para no tocar
            # fotos con detalle real (una pizza ronda 0,25).
            mask = None
            size = max(size, 7)
            iterations = max(iterations, 2)
        else:
            mask = smooth & ~near_empty
        grid = _mode_filter(grid, size=size, iterations=iterations, mask=mask)
        grid = _despeckle(grid, min_area)

    # 5) Red de seguridad: nada de celdas sueltas en "dibujo"/"cómic".
    if simplify >= 2:
        grid = _remove_isolated(grid, passes=2 if simplify == 2 else 3)

    return grid, chosen


def _outline(
    grid: np.ndarray,
    chosen: list[int],
    palette: Palette,
) -> tuple[np.ndarray, list[int]]:
    """Contorno oscuro de 1 celda alineado con la rejilla.

    Se marca el lado más oscuro de cada frontera de color (no las dos), así el
    trazo queda fino y continuo en vez de engordar los bordes.
    """
    if not chosen:
        return grid, chosen

    chosen_lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(palette.colors[i].hex) for i in chosen], dtype=np.float64)
        / 255.0
    )
    luminance = np.array(
        [color.relative_luminance(color.hex_to_rgb(palette.colors[i].hex)) for i in chosen]
    )
    height, width = grid.shape
    index = np.clip(grid, 0, None)
    lum_map = np.where(grid >= 0, luminance[index], np.inf)
    mark = np.zeros((height, width), dtype=bool)

    for dy, dx in ((0, 1), (1, 0)):
        a = grid[: height - dy, : width - dx]
        b = grid[dy:, dx:]
        la = lum_map[: height - dy, : width - dx]
        lb = lum_map[dy:, dx:]
        a_valid = a >= 0
        b_valid = b >= 0
        diff = a != b
        if not diff.any():
            continue
        distance = np.linalg.norm(
            chosen_lab[np.clip(a, 0, None)] - chosen_lab[np.clip(b, 0, None)], axis=-1
        )
        diff &= distance >= OUTLINE_MIN_DELTA_E
        # Si solo una de las dos es válida, se marca esa; si ambas lo son, la oscura.
        mark_first = diff & a_valid & ((la < lb) | ~b_valid)
        mark_second = diff & b_valid & ((lb <= la) | ~a_valid)
        mark[: height - dy, : width - dx] |= mark_first
        mark[dy:, dx:] |= mark_second

    if not mark.any():
        return grid, chosen

    full_lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(c.hex) for c in palette.colors], dtype=np.float64) / 255.0
    )
    darkest = int(np.argmin(full_lab[:, 0]))
    if darkest not in chosen:
        chosen = chosen + [darkest]
    darkest_local = chosen.index(darkest)

    grid = grid.copy()
    grid[mark] = darkest_local
    return grid, chosen


def _symbols(n: int) -> list[str]:
    if n > len(_SYMBOLS):
        # No debería ocurrir (máx. 64 colores), pero nunca repetimos símbolo.
        extra = [f"({i})" for i in range(n - len(_SYMBOLS))]
        return _SYMBOLS + extra
    return _SYMBOLS[:n]


def convert_image(
    data: bytes,
    craft: Craft = "hama",
    width: int = 40,
    max_colors: int = 14,
    simplify: int = 2,
    outline: bool = False,
    remove_background: bool = False,
    palette_id: str | None = None,
) -> PatternData:
    """Convierte los bytes de una imagen en un ``PatternData`` válido.

    Es una función pura (salvo aleatoriedad fija) para poder testearla sin HTTP.
    """
    if craft not in ("hama", "cross_stitch"):
        raise ValueError("Técnica no válida")
    width = max(1, min(MAX_PATTERN_SIDE, int(width)))
    simplify = max(0, min(3, int(simplify)))
    max_colors = max(1, min(MAX_PALETTE_COLORS, int(max_colors)))
    # El contorno añade el color más oscuro: reservamos una hueco para no pasar de 64.
    effective_max_colors = max(1, max_colors - 1) if outline else max_colors

    try:
        palette = palettes.get_palette(palette_id, craft)
    except KeyError as exc:
        raise PaletteNotFound(palette_id or "") from exc

    img = _load_rgba(data)
    img_w, img_h = img.size
    requested_width = max(1, min(MAX_PATTERN_SIDE, int(width)))

    # Nunca se amplía por encima del tamaño real: 20×30 con width=60 -> 20×30.
    width = min(requested_width, img_w)
    height = max(1, round(width * img_h / img_w))
    if height > MAX_PATTERN_SIDE:
        # Imagen muy alta: baja el ancho para conservar la proporción, sin recortar.
        width = max(1, min(img_w, int(img_w * MAX_PATTERN_SIDE / img_h)))
        height = max(1, min(MAX_PATTERN_SIDE, round(width * img_h / img_w)))

    pixel_art = (
        requested_width >= img_w
        and img_w <= MAX_PATTERN_SIDE
        and img_h <= MAX_PATTERN_SIDE
    )
    if pixel_art:
        width, height = img_w, img_h

    # ``remove_background`` se mantiene en la firma por compatibilidad con el
    # contrato de la API, pero ya no se aplica: el recorte se hace en el editor.
    _ = remove_background

    rgba = np.asarray(img, dtype=np.uint8)

    if pixel_art:
        # Pixel art exacto: 1 píxel = 1 celda, sin suavizado ni limpieza.
        grid = _nearest_palette_grid(rgba, palette)
        chosen = list(range(len(palette.colors)))
    else:
        rgb = rgba[..., :3]
        alpha = rgba[..., 3]

        # Resolución intermedia proporcional al patrón, acotada por arriba para que
        # el mean-shift siga siendo rápido con patrones grandes.
        work_side = min(MAX_WORK_SIDE, max(240, width * WORK_PIXELS_PER_CELL))
        scale = min(1.0, work_side / max(img_w, img_h))
        work_w = max(width, round(img_w * scale))
        work_h = max(height, round(img_h * scale))
        if (work_w, work_h) != (img_w, img_h):
            rgb = cv2.resize(rgb, (work_w, work_h), interpolation=cv2.INTER_AREA)
            alpha = cv2.resize(alpha, (work_w, work_h), interpolation=cv2.INTER_AREA)

        rgb = _simplify(rgb, simplify)

        # Reducción a la rejilla del patrón.
        rgb_small = cv2.resize(rgb, (width, height), interpolation=cv2.INTER_AREA)
        alpha_small = cv2.resize(alpha, (width, height), interpolation=cv2.INTER_AREA)
        empty = alpha_small < 128

        lab = color.srgb_to_lab(rgb_small / 255.0)
        grid, chosen = _quantize(lab, empty, palette, effective_max_colors)
        grid, chosen = _cleanup(grid, chosen, palette, simplify, lab)

        if outline:
            grid, chosen = _outline(grid, chosen, palette)

    if not chosen:
        return PatternData(craft=craft, width=width, height=height, palette=[], cells=[-1] * (width * height))

    # Ordenar la paleta final por frecuencia descendente.
    counts = _counts(grid, len(chosen))
    used = [int(i) for i in np.argsort(-counts) if counts[i] > 0]
    grid = _compact(grid, used)
    chosen = [chosen[i] for i in used]

    symbols = _symbols(len(chosen)) if craft == "cross_stitch" else [None] * len(chosen)
    out_palette = [
        PaletteColor(
            id=palette.colors[palette_index].id,
            name=palette.colors[palette_index].name,
            hex=palette.colors[palette_index].hex,
            symbol=symbols[i],
        )
        for i, palette_index in enumerate(chosen)
    ]

    cells = [int(v) for v in grid.ravel()]
    return PatternData(
        craft=craft,
        width=width,
        height=height,
        palette=out_palette,
        cells=cells,
    )


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Convierte una imagen en un patrón y guarda un PNG de previsualización.")
    parser.add_argument("image", type=Path)
    parser.add_argument("--craft", choices=["hama", "cross_stitch"], default="hama")
    parser.add_argument("--width", type=int, default=40)
    parser.add_argument("--colors", type=int, default=14, dest="max_colors")
    parser.add_argument("--simplify", type=int, choices=[0, 1, 2, 3], default=2)
    parser.add_argument("--outline", action="store_true")
    parser.add_argument("--remove-background", action="store_true")
    parser.add_argument("--palette", default=None)
    parser.add_argument("-o", "--output", type=Path, default=None)
    args = parser.parse_args(argv)

    data = args.image.read_bytes()
    pattern = convert_image(
        data,
        craft=args.craft,
        width=args.width,
        max_colors=args.max_colors,
        simplify=args.simplify,
        outline=args.outline,
        remove_background=args.remove_background,
        palette_id=args.palette,
    )
    output = args.output or args.image.with_name(f"{args.image.stem}_pattern.png")

    from .export import render_png

    output.write_bytes(render_png(pattern))
    print(
        f"{output}  ({pattern.width}x{pattern.height}, "
        f"{len(pattern.palette)} colores, {args.craft})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(_main())
