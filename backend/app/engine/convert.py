"""Imagen/foto -> PatternData (Hama o punto de cruz).

Pipeline:
1. Cargar con Pillow (EXIF), limitar tamaño y pasar a RGBA.
2. Simplificar a "dibujo" (bilateral / mean-shift) según ``simplify``.
3. Reducir a la rejilla del patrón con INTER_AREA y máscara de transparencia.
4. Cuantizar en CIELAB con k-means y mapear a colores reales de la paleta.
5. Limpiar colores raros y celdas aisladas.
6. Aplicar contorno y quitar fondo si se piden.
7. Construir un PatternData con solo los colores usados.
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
MAX_KMEANS_SAMPLE = 8000
BACKGROUND_TOLERANCE = 16.0

# Símbolos legibles para la carta de punto de cruz. Se generan sin repetir.
_BASE_SYMBOLS = list("X O + • / \\ # @ % & = ~ * ◆ ▲ ■ ● ★ ◇ △ □ ○ ☆ ♥ ♠ ♣ ♦".split())
_EXTRA_SYMBOLS = [c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" if c not in _BASE_SYMBOLS]
_SYMBOLS = _BASE_SYMBOLS + _EXTRA_SYMBOLS


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


def _simplify(rgb: np.ndarray, level: int) -> np.ndarray:
    """Aplica filtros de simplificación. ``rgb`` es uint8 HxWx3."""
    if level <= 0:
        return rgb

    src = np.ascontiguousarray(rgb)
    if level == 1:
        return cv2.bilateralFilter(src, d=9, sigmaColor=75, sigmaSpace=75)

    # Nivel 2 y 3: mean-shift + bilateral. El 3 añade más fuerza y saturación.
    spatial = 12 if level == 2 else 18
    color_radius = 35 if level == 2 else 55
    out = cv2.pyrMeanShiftFiltering(src, sp=spatial, sr=color_radius, maxLevel=1)
    out = cv2.bilateralFilter(out, d=9, sigmaColor=80, sigmaSpace=80)

    if level >= 3:
        hsv = cv2.cvtColor(out, cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[..., 1] = np.clip(hsv[..., 1] * 1.25, 0, 255)
        hsv[..., 2] = np.clip((hsv[..., 2] - 128.0) * 1.10 + 128.0, 0, 255)
        out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return out


def _remove_background(rgb: np.ndarray, empty: np.ndarray) -> np.ndarray:
    """Flood fill desde los bordes con tolerancia ΔE para marcar fondo como vacío.

    Solo se usa si la imagen no traía transparencia. Trabaja a resolución de rejilla.
    """
    if empty.any():
        return empty

    lab = color.srgb_to_lab(rgb / 255.0)
    h, w = empty.shape
    border = np.concatenate(
        [lab[0, :, :], lab[-1, :, :], lab[1:-1, 0, :], lab[1:-1, -1, :]], axis=0
    )
    if border.size == 0:
        return empty
    background = np.median(border, axis=0)

    mask = empty.copy()
    queue: deque[tuple[int, int]] = deque()

    def close_to_bg(y: int, x: int) -> bool:
        return float(np.linalg.norm(lab[y, x] - background)) <= BACKGROUND_TOLERANCE

    for x in range(w):
        for y in (0, h - 1):
            if not mask[y, x] and close_to_bg(y, x):
                mask[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y, x] and close_to_bg(y, x):
                mask[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and close_to_bg(ny, nx):
                mask[ny, nx] = True
                queue.append((ny, nx))
    return mask


def _quantize(
    lab: np.ndarray, empty: np.ndarray, palette: Palette, max_colors: int
) -> tuple[np.ndarray, list[int]]:
    """k-means en Lab -> colores de la paleta. Devuelve rejilla local y paleta elegida."""
    valid = ~empty
    if not valid.any():
        return np.full(empty.shape, -1, dtype=np.int16), []

    colors = lab[valid]
    unique = np.unique(np.round(colors, 4), axis=0)
    k = max(1, min(int(max_colors), MAX_PALETTE_COLORS, len(unique)))

    if k == 1 or len(unique) == 1:
        centers = unique[:1]
    else:
        sample = colors
        if len(sample) > MAX_KMEANS_SAMPLE:
            rng = np.random.default_rng(0)
            sample = colors[rng.choice(len(colors), MAX_KMEANS_SAMPLE, replace=False)]
        model = KMeans(n_clusters=k, n_init="auto", random_state=0)
        model.fit(sample)
        centers = model.cluster_centers_

    palette_lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(c.hex) for c in palette.colors], dtype=np.float64) / 255.0
    )
    mapped = color.nearest_palette(centers, palette_lab)
    chosen = list(dict.fromkeys(int(i) for i in mapped))  # deduplicar sin perder orden
    if not chosen:
        return np.full(empty.shape, -1, dtype=np.int16), []

    chosen_lab = palette_lab[chosen]
    local = color.nearest_palette(colors, chosen_lab)

    grid = np.full(empty.shape, -1, dtype=np.int16)
    grid[valid] = local.astype(np.int16)
    return grid, chosen


def _counts(grid: np.ndarray, n_colors: int) -> np.ndarray:
    return np.bincount(grid[grid >= 0], minlength=n_colors).astype(np.int64)


def _compact(grid: np.ndarray, keep: list[int]) -> np.ndarray:
    """Reindexa los colores locales conservando solo los índices de ``keep``."""
    remap = {old: new for new, old in enumerate(keep)}
    out = np.full(grid.shape, -1, dtype=np.int16)
    for old, new in remap.items():
        out[grid == old] = new
    return out


def _cleanup(
    grid: np.ndarray, chosen: list[int], palette: Palette, simplify: int
) -> tuple[np.ndarray, list[int]]:
    """Funde colores con <0,5 % de celdas y elimina celdas aisladas."""
    if not chosen:
        return grid, chosen

    n = len(chosen)
    palette_lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(palette.colors[i].hex) for i in chosen], dtype=np.float64) / 255.0
    )

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
            # Compactar el índice eliminado.
            grid = np.where(grid > smallest, grid - 1, grid)
            chosen = [c for i, c in enumerate(chosen) if i != smallest]
            palette_lab = np.delete(palette_lab, smallest, axis=0)
            n -= 1

    # Celdas aisladas: sin ningún vecino-4 de su mismo color -> color mayoritario vecino.
    for _ in range(2):
        h, w = grid.shape
        changed = False
        out = grid.copy()
        for y in range(h):
            for x in range(w):
                value = int(grid[y, x])
                if value < 0:
                    continue
                neighbours = []
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and grid[ny, nx] >= 0:
                        neighbours.append(int(grid[ny, nx]))
                if not neighbours or value in neighbours:
                    continue
                # Moda de los vecinos (empate: el primero encontrado).
                out[y, x] = max(set(neighbours), key=neighbours.count)
                changed = True
        grid = out
        if not changed:
            break

    return grid, chosen


def _outline(
    grid: np.ndarray,
    chosen: list[int],
    palette: Palette,
    rgb_working: np.ndarray,
) -> tuple[np.ndarray, list[int]]:
    """Añade un contorno oscuro tipo cómic usando Canny."""
    if not chosen:
        return grid, chosen

    gray = cv2.cvtColor(np.ascontiguousarray(rgb_working), cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 160)
    small = cv2.resize(edges, (grid.shape[1], grid.shape[0]), interpolation=cv2.INTER_AREA)
    edge_mask = (small > 22) & (grid >= 0)
    if not edge_mask.any():
        return grid, chosen

    # Color más oscuro de la paleta completa; se añade si no estaba elegido.
    lab = color.srgb_to_lab(
        np.array([color.hex_to_rgb(c.hex) for c in palette.colors], dtype=np.float64) / 255.0
    )
    darkest = int(np.argmin(lab[:, 0]))
    if darkest not in chosen:
        chosen = chosen + [darkest]
    darkest_local = chosen.index(darkest)

    grid = grid.copy()
    grid[edge_mask] = darkest_local
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
    width: int = 29,
    max_colors: int = 12,
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
    height = max(1, min(MAX_PATTERN_SIDE, round(width * img_h / img_w)))

    rgba = np.asarray(img, dtype=np.uint8)
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]

    # Resolución intermedia ~ width*8, sin pasar de 1024 px de lado.
    scale = min(1.0, (width * 8) / img_w)
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

    if remove_background:
        empty = _remove_background(rgb_small, empty)

    lab = color.srgb_to_lab(rgb_small / 255.0)
    grid, chosen = _quantize(lab, empty, palette, effective_max_colors)
    grid, chosen = _cleanup(grid, chosen, palette, simplify)

    if outline:
        grid, chosen = _outline(grid, chosen, palette, rgb)

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
    parser.add_argument("--colors", type=int, default=12, dest="max_colors")
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
