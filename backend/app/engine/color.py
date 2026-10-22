"""Color: sRGB -> CIELAB y distancia ΔE (CIE76).

Todo el emparejamiento de colores del motor se hace en Lab, nunca en RGB.
Las funciones aceptan arrays de forma (..., 3) y son vectorizadas con NumPy.
"""
from __future__ import annotations

import numpy as np

# Blanco de referencia D65.
_WHITE = np.array([0.95047, 1.0, 1.08883], dtype=np.float64)

# sRGB lineal -> XYZ (D65).
_RGB2XYZ = np.array(
    [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ],
    dtype=np.float64,
)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    """'#RRGGBB' -> (r, g, b) en 0..255."""
    value = value.strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Color hex inválido: {value!r}")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb) -> str:
    """(r, g, b) 0..255 -> '#RRGGBB'."""
    r, g, b = (int(round(float(c))) for c in rgb)
    return f"#{max(0, min(255, r)):02X}{max(0, min(255, g)):02X}{max(0, min(255, b)):02X}"


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Convierte sRGB (float 0..1, forma (..., 3)) a CIELAB (D65).

    Si el array viene en 0..255 se detecta y se normaliza automáticamente.
    """
    arr = np.asarray(rgb, dtype=np.float64)
    if arr.size and arr.max() > 1.0:
        arr = arr / 255.0

    linear = np.where(arr <= 0.04045, arr / 12.92, ((arr + 0.055) / 1.055) ** 2.4)
    xyz = linear @ _RGB2XYZ.T
    xyz = xyz / _WHITE

    delta = 6.0 / 29.0
    f = np.where(xyz > delta**3, np.cbrt(xyz), xyz / (3 * delta**2) + 4.0 / 29.0)

    lightness = 116.0 * f[..., 1] - 16.0
    a = 500.0 * (f[..., 0] - f[..., 1])
    b = 200.0 * (f[..., 1] - f[..., 2])
    return np.stack([lightness, a, b], axis=-1)


def lab_to_lch(lab: np.ndarray) -> np.ndarray:
    """Utilidad de depuración: Lab -> LCh."""
    arr = np.asarray(lab, dtype=np.float64)
    c = np.hypot(arr[..., 1], arr[..., 2])
    h = np.degrees(np.arctan2(arr[..., 2], arr[..., 1])) % 360.0
    return np.stack([arr[..., 0], c, h], axis=-1)


def delta_e(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """Distancia ΔE CIE76 entre dos arrays Lab compatibles por broadcasting."""
    return np.linalg.norm(np.asarray(lab1) - np.asarray(lab2), axis=-1)


def nearest_palette(lab: np.ndarray, palette_lab: np.ndarray) -> np.ndarray:
    """Índice del color de la paleta más cercano para cada Lab de entrada.

    ``lab``: (N, 3) o (3,); ``palette_lab``: (M, 3). Devuelve (N,) de índices.
    """
    colors = np.atleast_2d(np.asarray(lab, dtype=np.float64))
    pal = np.asarray(palette_lab, dtype=np.float64)
    if pal.ndim != 2 or pal.shape[0] == 0:
        raise ValueError("La paleta no puede estar vacía")
    # (N, 1, 3) - (1, M, 3) -> (N, M)
    distances = np.linalg.norm(colors[:, None, :] - pal[None, :, :], axis=-1)
    return np.argmin(distances, axis=1)


def relative_luminance(rgb) -> float:
    """Luminancia relativa sRGB (0..1), útil para elegir texto claro/oscuro."""
    arr = np.asarray(rgb, dtype=np.float64) / 255.0
    linear = np.where(arr <= 0.04045, arr / 12.92, ((arr + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2])
