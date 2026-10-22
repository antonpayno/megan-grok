"""Cartas imprimibles de patrones: PNG y PDF (A4).

PNG: rejilla con reglas cada 5/10, numeración, símbolos para punto de cruz y
leyenda con muestra, código, nombre y nº de cuentas/puntadas.

PDF: página 1 con vista previa + leyenda; páginas siguientes con la carta
troceada en bloques de 40x50 celdas y numeración global.
"""
from __future__ import annotations

import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from ..schemas import PatternData
from .color import hex_to_rgb, relative_luminance

_PAPER = (250, 247, 242)
_INK = (32, 30, 28)
_GRID_LIGHT = (214, 209, 200)
_GRID_MID = (150, 143, 132)
_GRID_STRONG = (90, 85, 78)

_DEJAVU = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
_DEJAVU_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
_PDF_FONT = "Helvetica"
_PDF_FONT_BOLD = "Helvetica-Bold"


def _font(size: int, bold: bool = False):
    path = _DEJAVU_BOLD if bold else _DEJAVU
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        try:
            return ImageFont.load_default(size=size)
        except TypeError:  # Pillow antiguo
            return ImageFont.load_default()


def _register_pdf_fonts() -> None:
    global _PDF_FONT, _PDF_FONT_BOLD
    try:
        pdfmetrics.registerFont(TTFont("PatternDejaVu", str(_DEJAVU)))
        pdfmetrics.registerFont(TTFont("PatternDejaVu-Bold", str(_DEJAVU_BOLD)))
        _PDF_FONT = "PatternDejaVu"
        _PDF_FONT_BOLD = "PatternDejaVu-Bold"
    except Exception:
        _PDF_FONT = "Helvetica"
        _PDF_FONT_BOLD = "Helvetica-Bold"


def _counts(pattern: PatternData) -> list[int]:
    counts = [0] * len(pattern.palette)
    for cell in pattern.cells:
        if 0 <= cell < len(counts):
            counts[cell] += 1
    return counts


def _symbol_color(hex_value: str) -> tuple[int, int, int]:
    return (255, 255, 255) if relative_luminance(hex_to_rgb(hex_value)) < 0.45 else (24, 24, 24)


def _truncate(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text
    ellipsis = "…"
    while text and draw.textlength(text + ellipsis, font=font) > max_width:
        text = text[:-1]
    return text + ellipsis


def _draw_cell(
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    cell: int,
    pattern: PatternData,
    color_index: int,
    symbol_font,
) -> None:
    color = pattern.palette[color_index]
    rgb = hex_to_rgb(color.hex)
    if pattern.craft == "hama":
        inset = max(1, cell * 0.06)
        draw.ellipse([x + inset, y + inset, x + cell - inset, y + cell - inset], fill=rgb)
        hole = cell * 0.16
        cx, cy = x + cell / 2, y + cell / 2
        draw.ellipse([cx - hole, cy - hole, cx + hole, cy + hole], fill=_PAPER)
    else:
        draw.rectangle([x, y, x + cell, y + cell], fill=rgb)
        symbol = color.symbol
        if symbol and cell >= 8:
            draw.text(
                (x + cell / 2, y + cell / 2),
                symbol,
                font=symbol_font,
                fill=_symbol_color(color.hex),
                anchor="mm",
            )


def _draw_grid(
    draw: ImageDraw.ImageDraw,
    pattern: PatternData,
    x0: int,
    y0: int,
    cell: int,
) -> None:
    symbol_font = _font(max(6, int(cell * 0.55)))
    for y in range(pattern.height):
        for x in range(pattern.width):
            index = pattern.cells[y * pattern.width + x]
            if index >= 0:
                _draw_cell(draw, x0 + x * cell, y0 + y * cell, cell, pattern, index, symbol_font)

    for i in range(pattern.width + 1):
        x = x0 + i * cell
        width = 2 if i % 10 == 0 else 1
        fill = _GRID_STRONG if i % 10 == 0 else (_GRID_MID if i % 5 == 0 else _GRID_LIGHT)
        draw.line([(x, y0), (x, y0 + pattern.height * cell)], fill=fill, width=width)
    for j in range(pattern.height + 1):
        y = y0 + j * cell
        width = 2 if j % 10 == 0 else 1
        fill = _GRID_STRONG if j % 10 == 0 else (_GRID_MID if j % 5 == 0 else _GRID_LIGHT)
        draw.line([(x0, y), (x0 + pattern.width * cell, y)], fill=fill, width=width)


def _draw_rulers(
    draw: ImageDraw.ImageDraw,
    pattern: PatternData,
    x0: int,
    y0: int,
    cell: int,
) -> None:
    font = _font(max(8, min(13, int(cell * 0.55))))
    for i in range(0, pattern.width, 5):
        value = i + 1
        draw.text(
            (x0 + i * cell + cell / 2, y0 - 8),
            str(value),
            font=font,
            fill=_INK,
            anchor="mb",
        )
    for j in range(0, pattern.height, 5):
        value = j + 1
        draw.text(
            (x0 - 8, y0 + j * cell + cell / 2),
            str(value),
            font=font,
            fill=_INK,
            anchor="rm",
        )


def render_png(
    pattern: PatternData,
    cell: int = 22,
    include_title: bool = True,
    include_legend: bool = True,
    include_rulers: bool = True,
) -> bytes:
    """Genera la carta PNG completa (rejilla + leyenda) en memoria."""
    cell = max(6, int(cell))
    pad = 18
    title_h = 58 if include_title else 0
    left = 44 if include_rulers else 0
    top = 26 if include_rulers else 0
    grid_w = pattern.width * cell
    grid_h = pattern.height * cell

    total_w = max(640, grid_w + left + pad * 2)
    x0 = max(left + pad, (total_w - grid_w) // 2)
    y0 = title_h + top

    counts = _counts(pattern)
    if include_legend and pattern.palette:
        columns = max(1, min(4, (total_w - pad * 2) // 250))
        rows = math.ceil(len(pattern.palette) / columns)
        legend_h = 34 + rows * 21
    else:
        columns = 0
        legend_h = 0
    total_h = y0 + grid_h + (pad + legend_h if include_legend else pad)

    image = Image.new("RGB", (total_w, total_h), _PAPER)
    draw = ImageDraw.Draw(image)

    if include_title:
        draw.text((pad, 10), "Pixel Pattern", font=_font(25, bold=True), fill=_INK)
        subtitle = f"{'HAMA' if pattern.craft == 'hama' else 'Punto de cruz'} · {pattern.width}×{pattern.height} · {len(pattern.palette)} colores"
        draw.text((pad, 38), subtitle, font=_font(13), fill=(95, 90, 84))

    _draw_grid(draw, pattern, x0, y0, cell)
    if include_rulers:
        _draw_rulers(draw, pattern, x0, y0, cell)

    if include_legend and pattern.palette:
        legend_y = y0 + grid_h + 18
        total = sum(counts)
        unit = "cuentas" if pattern.craft == "hama" else "puntadas"
        draw.text(
            (pad, legend_y),
            f"Leyenda · {total} {unit} · {len(pattern.palette)} colores",
            font=_font(13, bold=True),
            fill=_INK,
        )
        col_width = (total_w - pad * 2) // columns
        font = _font(11)
        font_bold = _font(11, bold=True)
        for i, color in enumerate(pattern.palette):
            col = i % columns
            row = i // columns
            ix = pad + col * col_width
            iy = legend_y + 28 + row * 21
            draw.rectangle([ix, iy, ix + 14, iy + 14], fill=hex_to_rgb(color.hex), outline=_GRID_MID)
            label = f"{color.id} {color.name}"
            if color.symbol:
                label = f"{color.symbol}  {label}"
            draw.text((ix + 20, iy + 7), _truncate(draw, label, font, col_width - 78), font=font, fill=_INK, anchor="lm")
            draw.text(
                (ix + col_width - 6, iy + 7),
                f"{counts[i]} {unit}",
                font=font_bold,
                fill=_INK,
                anchor="rm",
            )

    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _preview_image(pattern: PatternData) -> Image.Image:
    """Vista previa sin título ni leyenda para incrustar en el PDF."""
    cell = max(8, min(28, 900 // max(pattern.width, pattern.height)))
    pad = 10
    left = 34
    top = 22
    grid_w = pattern.width * cell
    grid_h = pattern.height * cell
    image = Image.new("RGB", (grid_w + left + pad * 2, grid_h + top + pad * 2), _PAPER)
    draw = ImageDraw.Draw(image)
    x0 = left + pad
    y0 = top + pad
    _draw_grid(draw, pattern, x0, y0, cell)
    _draw_rulers(draw, pattern, x0, y0, cell)
    return image


def _pdf_tile(
    pdf: canvas.Canvas,
    pattern: PatternData,
    counts: list[int],
    page_no: int,
    col0: int,
    row0: int,
    tile_w: int,
    tile_h: int,
    font_name: str,
    font_bold: str,
) -> None:
    page_w, page_h = A4
    margin = 36
    header = 62
    available_w = page_w - margin * 2
    available_h = page_h - margin * 2 - header
    cell = min(available_w / tile_w, available_h / tile_h)
    grid_w = tile_w * cell
    grid_h = tile_h * cell
    x0 = (page_w - grid_w) / 2
    top_y = page_h - margin - header

    pdf.setFillColor(HexColor("#20201C"))
    pdf.setFont(font_bold, 16)
    pdf.drawString(margin, page_h - margin - 18, "Pixel Pattern — carta de montaje")
    pdf.setFont(font_name, 9)
    col_end = min(pattern.width, col0 + tile_w)
    row_end = min(pattern.height, row0 + tile_h)
    pdf.drawString(
        margin,
        page_h - margin - 33,
        f"Columnas {col0 + 1}–{col_end} · Filas {row0 + 1}–{row_end} · "
        f"{'HAMA' if pattern.craft == 'hama' else 'punto de cruz'} · página {page_no}",
    )

    for local_y in range(row_end - row0):
        for local_x in range(col_end - col0):
            x = col0 + local_x
            y = row0 + local_y
            index = pattern.cells[y * pattern.width + x]
            px = x0 + local_x * cell
            py = top_y - (local_y + 1) * cell
            if index < 0:
                continue
            color = pattern.palette[index]
            pdf.setFillColor(HexColor(color.hex))
            pdf.rect(px, py, cell, cell, fill=1, stroke=0)
            if pattern.craft == "cross_stitch" and color.symbol and cell >= 9:
                pdf.setFillColor(HexColor("#FFFFFF" if relative_luminance(hex_to_rgb(color.hex)) < 0.45 else "#181818"))
                pdf.setFont(font_name, max(5, cell * 0.58))
                pdf.drawCentredString(px + cell / 2, py + cell * 0.3, color.symbol)

    pdf.setLineWidth(0.25)
    for i in range(tile_w + 1):
        if col0 + i > pattern.width:
            break
        x = x0 + i * cell
        if (col0 + i) % 10 == 0:
            pdf.setStrokeColor(HexColor("#5A554E"))
            pdf.setLineWidth(0.8)
        elif (col0 + i) % 5 == 0:
            pdf.setStrokeColor(HexColor("#968F84"))
            pdf.setLineWidth(0.45)
        else:
            pdf.setStrokeColor(HexColor("#D6D1C8"))
            pdf.setLineWidth(0.2)
        pdf.line(x, top_y - grid_h, x, top_y)
    for j in range(tile_h + 1):
        if row0 + j > pattern.height:
            break
        y = top_y - j * cell
        if (row0 + j) % 10 == 0:
            pdf.setStrokeColor(HexColor("#5A554E"))
            pdf.setLineWidth(0.8)
        elif (row0 + j) % 5 == 0:
            pdf.setStrokeColor(HexColor("#968F84"))
            pdf.setLineWidth(0.45)
        else:
            pdf.setStrokeColor(HexColor("#D6D1C8"))
            pdf.setLineWidth(0.2)
        pdf.line(x0, y, x0 + grid_w, y)

    pdf.setFillColor(HexColor("#20201C"))
    pdf.setFont(font_name, 7)
    for local_x in range(0, col_end - col0, 5):
        global_col = col0 + local_x + 1
        pdf.drawCentredString(x0 + local_x * cell + cell / 2, top_y + 4, str(global_col))
    for local_y in range(0, row_end - row0, 5):
        global_row = row0 + local_y + 1
        pdf.drawRightString(x0 - 4, top_y - (local_y + 1) * cell + cell * 0.3, str(global_row))

    unit = "cuentas" if pattern.craft == "hama" else "puntadas"
    pdf.setFont(font_name, 8)
    pdf.drawString(margin, margin, f"Total del patrón: {sum(counts)} {unit} · {len(pattern.palette)} colores")


def render_pdf(pattern: PatternData, tile_w: int = 40, tile_h: int = 50) -> bytes:
    """Genera una carta PDF A4 con vista previa, leyenda y páginas troceadas."""
    _register_pdf_fonts()
    out = io.BytesIO()
    pdf = canvas.Canvas(out, pagesize=A4)
    page_w, page_h = A4
    counts = _counts(pattern)
    unit = "cuentas" if pattern.craft == "hama" else "puntadas"

    # ---- Página 1: vista previa + leyenda ----
    margin = 40
    pdf.setFillColor(HexColor("#20201C"))
    pdf.setFont(_PDF_FONT_BOLD, 22)
    pdf.drawString(margin, page_h - 52, "Pixel Pattern")
    pdf.setFont(_PDF_FONT, 10)
    pdf.drawString(
        margin,
        page_h - 68,
        f"{'HAMA' if pattern.craft == 'hama' else 'Punto de cruz'} · "
        f"{pattern.width}×{pattern.height} · {len(pattern.palette)} colores · {sum(counts)} {unit}",
    )

    preview = _preview_image(pattern)
    max_w = page_w - margin * 2
    legend_rows = math.ceil(len(pattern.palette) / 3) if pattern.palette else 0
    legend_space = 40 + legend_rows * 13
    max_h = page_h - 86 - legend_space - 40
    ratio = min(max_w / preview.width, max_h / preview.height, 1.0)
    pw, ph = preview.width * ratio, preview.height * ratio
    px = (page_w - pw) / 2
    py = page_h - 86 - ph
    pdf.drawImage(
        ImageReader(preview),
        px,
        py,
        width=pw,
        height=ph,
        preserveAspectRatio=True,
        mask="auto",
    )

    # Leyenda en hasta 3 columnas.
    legend_top = py - 22
    pdf.setFont(_PDF_FONT_BOLD, 12)
    pdf.drawString(margin, legend_top, "Leyenda")
    columns = 3
    col_w = (page_w - margin * 2) / columns
    rows = math.ceil(len(pattern.palette) / columns) if pattern.palette else 0
    pdf.setFont(_PDF_FONT, 8)
    for i, color in enumerate(pattern.palette):
        col = i % columns
        row = i // columns
        cx = margin + col * col_w
        cy = legend_top - 16 - row * 13
        pdf.setFillColor(HexColor(color.hex))
        pdf.rect(cx, cy - 1, 9, 9, fill=1, stroke=0)
        pdf.setFillColor(HexColor("#20201C"))
        label = f"{color.symbol + '  ' if color.symbol else ''}{color.id} {color.name}"
        pdf.drawString(cx + 13, cy, label[:38])
        pdf.drawRightString(cx + col_w - 6, cy, str(counts[i]))
    if rows > 18:  # seguridad: no salir de la página
        pdf.setFont(_PDF_FONT, 7)
        pdf.drawString(margin, margin, "Leyenda truncada; consulta las páginas de la carta.")

    pdf.setFont(_PDF_FONT, 8)
    pdf.drawString(margin, margin, f"Total: {sum(counts)} {unit} · {len(pattern.palette)} colores")
    pdf.showPage()

    # ---- Páginas 2..N: carta troceada ----
    page_no = 2
    for row0 in range(0, pattern.height, tile_h):
        for col0 in range(0, pattern.width, tile_w):
            _pdf_tile(
                pdf, pattern, counts, page_no, col0, row0, tile_w, tile_h,
                _PDF_FONT, _PDF_FONT_BOLD,
            )
            pdf.showPage()
            page_no += 1

    pdf.save()
    return out.getvalue()


def export_pattern(pattern: PatternData, fmt: str = "png") -> bytes:
    """Punto de entrada del router: devuelve los bytes del formato pedido."""
    if fmt == "png":
        return render_png(pattern)
    if fmt == "pdf":
        return render_pdf(pattern)
    raise ValueError(f"Formato no soportado: {fmt}")
