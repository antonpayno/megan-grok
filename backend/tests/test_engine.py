"""Tests del motor imagen -> patrón (Persona 2).

Imágenes sintéticas creadas en memoria: no hacen falta assets ni servicios.
"""
from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.engine import palettes
from app.engine.convert import (
    _despeckle,
    _merge_similar,
    _outline,
    _symbols,
)
from app.engine.export import _tile_positions, render_pdf
from app.schemas import Palette, PaletteColor, PatternData


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _bicolor(width: int = 64, height: int = 32) -> bytes:
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, width // 2 - 1, height - 1], fill=(220, 20, 30))
    draw.rectangle([width // 2, 0, width - 1, height - 1], fill=(20, 40, 200))
    return _png(image)


def _post(client, data: bytes, **options):
    return client.post(
        "/api/patterns/convert",
        files={"file": ("test.png", data, "image/png")},
        data={"craft": "hama", "width": 20, "max_colors": 8, "simplify": 0, **options},
    )


def test_palettes(client):
    response = client.get("/api/palettes")
    assert response.status_code == 200
    data = {palette["id"]: palette for palette in response.json()}
    assert {"hama_midi", "dmc"} <= data.keys()
    assert len(data["hama_midi"]["colors"]) >= 40
    assert len(data["dmc"]["colors"]) >= 80
    assert data["hama_midi"]["craft"] == "hama"
    assert data["dmc"]["craft"] == "cross_stitch"
    # Los códigos son únicos dentro de cada paleta.
    for palette in data.values():
        codes = [color["id"] for color in palette["colors"]]
        assert len(codes) == len(set(codes))


def test_convert_proportional_dimensions(client):
    response = _post(client, _bicolor(200, 100), width=20)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert (pattern.width, pattern.height) == (20, 10)
    assert len(pattern.cells) == 200


def test_convert_bicolor_uses_two_colors(client):
    response = _post(client, _bicolor(), max_colors=2)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert len(pattern.palette) == 2
    assert len({c for c in pattern.cells if c >= 0}) == 2


def test_convert_colors_belong_to_palette(client):
    response = _post(client, _bicolor(), craft="cross_stitch", max_colors=4)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    dmc_ids = {color.id for color in palettes.DMC.colors}
    assert all(color.id in dmc_ids for color in pattern.palette)
    # Punto de cruz: todos los colores llevan símbolo y son distintos.
    assert all(color.symbol for color in pattern.palette)
    assert len({color.symbol for color in pattern.palette}) == len(pattern.palette)


def test_transparent_pixels_become_empty(client):
    image = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle([10, 0, 19, 19], fill=(220, 20, 30, 255))
    response = _post(client, _png(image), width=10, simplify=2)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert pattern.cells.count(-1) >= 40


def test_simplify_flattens_high_frequency_noise(client):
    # Rayas diagonales de alta frecuencia: sin el filtro de moda saldrían
    # muchísimas celdas aisladas ("sal y pimienta").
    import numpy as np

    yy, xx = np.mgrid[0:240, 0:240]
    band = ((xx + yy) // 10) % 4
    colors = np.array([[220, 40, 60], [40, 160, 90], [40, 90, 220], [245, 200, 60]], dtype=np.uint8)
    image = Image.fromarray(colors[band], "RGB")

    response = _post(client, _png(image), width=40, max_colors=10, simplify=2)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    width = pattern.width
    isolated = 0
    non_empty = 0
    for y in range(pattern.height):
        for x in range(width):
            value = pattern.cells[y * width + x]
            if value < 0:
                continue
            non_empty += 1
            neighbours = []
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < pattern.height:
                    neighbour = pattern.cells[ny * width + nx]
                    if neighbour >= 0:
                        neighbours.append(neighbour)
            if neighbours and value not in neighbours:
                isolated += 1
    assert non_empty > 0
    assert isolated / non_empty < 0.02


def test_remove_background_marks_cells_empty(client):
    image = Image.new("RGB", (40, 40), "white")
    ImageDraw.Draw(image).rectangle([12, 12, 27, 27], fill=(20, 20, 20))
    response = _post(
        client, _png(image), width=20, max_colors=2, simplify=0, remove_background="true"
    )
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert pattern.cells.count(-1) > 0
    # El cuadrado central debe sobrevivir.
    assert pattern.cells[10 * pattern.width + 10] != -1


def test_invalid_file_returns_400(client):
    response = client.post(
        "/api/patterns/convert",
        files={"file": ("test.png", b"esto no es una imagen", "image/png")},
        data={"craft": "hama", "width": 20, "max_colors": 8, "simplify": 0},
    )
    assert response.status_code == 400


def test_upload_too_large_returns_400(client):
    response = client.post(
        "/api/patterns/convert",
        files={"file": ("big.png", b"0" * (10 * 1024 * 1024 + 1), "image/png")},
        data={"craft": "hama", "width": 20, "max_colors": 8, "simplify": 0},
    )
    assert response.status_code == 400


def test_unknown_palette_returns_404(client):
    response = _post(client, _bicolor(), palette_id="no_existe")
    assert response.status_code == 404


def test_outline_keeps_valid_pattern(client):
    response = _post(client, _bicolor(), width=24, max_colors=3, outline="true")
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert len(pattern.palette) >= 1
    assert all(0 <= c < len(pattern.palette) or c == -1 for c in pattern.cells)


def test_conversion_is_reproducible(client):
    data = _bicolor()
    first = _post(client, data, max_colors=3)
    second = _post(client, data, max_colors=3)
    assert first.json() == second.json()


def test_outline_never_exceeds_palette_limit(client):
    # Imagen de ruido con muchos colores + max_colors=64 + contorno.
    import random

    random.seed(0)
    pixels = [(random.randrange(256), random.randrange(256), random.randrange(256)) for _ in range(64 * 64)]
    image = Image.new("RGB", (64, 64))
    image.putdata(pixels)
    response = _post(
        client, _png(image), width=32, max_colors=64, simplify=1, outline="true"
    )
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert len(pattern.palette) <= 64


def test_export_png_and_pdf(client):
    pattern = PatternData(
        craft="hama",
        width=4,
        height=4,
        palette=[PaletteColor(id="H05", name="Rojo", hex="#E30613")],
        cells=[0] * 16,
    )
    png = client.post("/api/patterns/export?format=png", json=pattern.model_dump())
    assert png.status_code == 200
    assert png.content.startswith(b"\x89PNG")
    assert png.headers["content-type"].startswith("image/png")
    assert "attachment" in png.headers["content-disposition"]

    pdf = client.post("/api/patterns/export?format=pdf", json=pattern.model_dump())
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")
    assert pdf.headers["content-type"].startswith("application/pdf")


def test_export_cross_stitch_with_symbols(client):
    pattern = PatternData(
        craft="cross_stitch",
        width=3,
        height=3,
        palette=[
            PaletteColor(id="310", name="Negro", hex="#000000", symbol="X"),
            PaletteColor(id="B5200", name="Blanco", hex="#FFFFFF", symbol="O"),
        ],
        cells=[0, 1, 0, 1, 0, 1, 0, 1, 0],
    )
    response = client.post("/api/patterns/export?format=png", json=pattern.model_dump())
    assert response.status_code == 200
    assert response.content.startswith(b"\x89PNG")


@pytest.mark.parametrize("craft,expected", [("hama", "hama_midi"), ("cross_stitch", "dmc")])
def test_default_palette_depends_on_craft(client, craft, expected):
    response = _post(client, _bicolor(), craft=craft, max_colors=4)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    palette = palettes.get_palette(None, craft)
    assert palette.id == expected
    assert {color.id for color in pattern.palette} <= {color.id for color in palette.colors}


# ---------- Pulido del motor (P2) ----------

def test_api_defaults_are_the_ones_the_ui_should_use(client):
    # width=40 / 14 colores: lo que recomienda el motor para la demo.
    response = client.post(
        "/api/patterns/convert",
        files={"file": ("test.png", _bicolor(200, 100), "image/png")},
        data={"craft": "hama"},
    )
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert (pattern.width, pattern.height) == (40, 20)
    assert len(pattern.palette) <= 14


def test_symbols_are_ascii_unique_and_not_confusable():
    symbols = _symbols(64)
    assert len(symbols) == len(set(symbols)) == 64
    assert all(len(symbol) == 1 and symbol.isascii() and symbol.isprintable() for symbol in symbols)
    # Pares que en una carta impresa se confunden (0/O, 1/l/I, x/X).
    assert not {"0", "1", "l", "I", "x"} & set(symbols)


def test_pdf_has_one_page_per_tile():
    pattern = PatternData(
        craft="cross_stitch",
        width=100,
        height=100,
        palette=[
            PaletteColor(id="310", name="Negro", hex="#000000", symbol="X"),
            PaletteColor(id="B5200", name="Blanco", hex="#FFFFFF", symbol="O"),
        ],
        cells=[0 if (i // 100 + i % 100) % 2 else 1 for i in range(100 * 100)],
    )
    pdf = render_pdf(pattern)
    # ReportLab escribe /Type /Pages una vez (el árbol) y /Type /Page por página.
    pages = pdf.count(b"/Type /Page") - pdf.count(b"/Type /Pages")
    assert pages == 1 + len(_tile_positions(pattern, 40, 50))


def test_remove_background_also_works_with_partial_transparency(client):
    # Logo con una franja transparente y fondo blanco opaco: antes, con
    # cualquier píxel transparente, el quitafondo se saltaba entero.
    image = Image.new("RGBA", (40, 40), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, 3, 39], fill=(0, 0, 0, 0))
    draw.ellipse([14, 14, 25, 25], fill=(200, 30, 40, 255))
    response = _post(
        client, _png(image), width=20, max_colors=4, simplify=0, remove_background="true"
    )
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    width = pattern.width
    assert pattern.cells[width - 1] == -1  # esquina blanca opaca
    assert pattern.cells[0] == -1  # franja transparente
    assert pattern.cells[10 * width + 10] != -1  # el círculo sigue ahí


def test_despeckle_removes_single_cells():
    grid = np.zeros((7, 7), dtype=np.int16)
    grid[3, 3] = 1
    cleaned = _despeckle(grid, min_area=2)
    assert cleaned[3, 3] == 0
    assert 1 not in cleaned


def test_merge_similar_fuses_near_duplicate_colors():
    palette_lab = np.array([[50.0, 0.0, 0.0], [51.5, 0.0, 0.0], [50.0, 25.0, 25.0]])
    grid = np.zeros((4, 6), dtype=np.int16)
    grid[:, 2:4] = 1
    grid[:, 4:] = 2
    merged, chosen = _merge_similar(grid, [0, 1, 2], palette_lab, threshold=4.0)
    assert len(chosen) == 2
    assert len(set(merged[merged >= 0].tolist())) == 2


def test_outline_marks_only_the_dark_side():
    palette = Palette(
        id="test",
        name="Test",
        craft="hama",
        colors=[
            PaletteColor(id="R", name="Rojo", hex="#FF0000"),
            PaletteColor(id="G", name="Verde", hex="#00FF00"),
            PaletteColor(id="K", name="Negro", hex="#000000"),
        ],
    )
    grid = np.zeros((4, 4), dtype=np.int16)
    grid[:, 2:] = 1
    outlined, chosen = _outline(grid, [0, 1], palette)
    # El rojo (más oscuro) recibe el contorno; el verde no se engorda.
    assert outlined[:, 1].tolist() == [2, 2, 2, 2]
    assert outlined[:, 2].tolist() == [1, 1, 1, 1]
    assert outlined[:, 0].tolist() == [0, 0, 0, 0]
    assert chosen[-1] == 2


def test_noisy_background_ends_up_flat(client):
    rng = np.random.default_rng(7)
    base = np.full((120, 120, 3), 200, dtype=np.int16)
    base += rng.integers(-7, 8, size=(120, 120, 3))
    image = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")
    ImageDraw.Draw(image).ellipse([40, 40, 79, 79], fill=(200, 30, 40))

    response = _post(client, _png(image), width=40, max_colors=8, simplify=2)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    width = pattern.width
    corner = {pattern.cells[y * width + x] for y in range(3) for x in range(3)}
    assert len(corner) == 1


def test_skin_tones_stay_warm(client):
    rng = np.random.default_rng(3)
    skin = np.full((120, 120, 3), (224, 172, 140), dtype=np.int16)
    skin += rng.integers(-5, 6, size=(120, 120, 3))
    image = Image.fromarray(np.clip(skin, 0, 255).astype(np.uint8), "RGB")

    response = _post(client, _png(image), width=24, max_colors=5, simplify=2)
    assert response.status_code == 200
    pattern = PatternData(**response.json())
    assert pattern.palette
    for color in pattern.palette:
        r, g, b = (int(color.hex[i : i + 2], 16) for i in (1, 3, 5))
        assert r >= g >= b, f"{color.hex} no es un tono cálido"
        assert r - b >= 20, f"{color.hex} se ha quedado gris"

