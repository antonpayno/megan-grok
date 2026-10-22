"""PROPIETARIO: Persona 2 (motor de patrones). Solo Persona 2 edita este archivo
y todo lo que hay en app/engine/."""
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..engine import palettes
from ..engine.convert import InvalidImage, PaletteNotFound, convert_image
from ..engine.export import export_pattern
from ..schemas import Craft, Palette, PatternData

router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@router.get("/palettes", response_model=list[Palette])
def list_palettes():
    """Todas las paletas disponibles (al menos 'hama_midi' y 'dmc')."""
    return palettes.all_palettes()


@router.post("/patterns/convert", response_model=PatternData)
async def convert(
    file: UploadFile = File(...),
    craft: Craft = Form("hama"),
    width: int = Form(40, ge=4, le=128),     # alto = proporcional a la imagen
    max_colors: int = Form(14, ge=2, le=64),
    simplify: int = Form(2, ge=0, le=3),     # 0 = fiel a la foto … 3 = muy "dibujo"
    outline: bool = Form(False),              # contorno oscuro estilo cartoon
    remove_background: bool = Form(False),    # fondo -> celdas vacías (-1)
    palette_id: str | None = Form(None),      # por defecto: hama_midi o dmc según craft
):
    """Imagen/foto -> PatternData simplificado y mapeado a colores reales de la paleta."""
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/") and content_type != "application/octet-stream":
        raise HTTPException(400, "El archivo debe ser una imagen")

    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(400, "El archivo está vacío")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "La imagen supera los 10 MB")

    try:
        return await run_in_threadpool(
            convert_image,
            data,
            craft,
            width,
            max_colors,
            simplify,
            outline,
            remove_background,
            palette_id,
        )
    except PaletteNotFound as exc:
        raise HTTPException(404, f"No existe la paleta {exc}") from exc
    except InvalidImage as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/patterns/export")
def export(pattern: PatternData, format: Literal["png", "pdf"] = "png"):
    """Devuelve la carta imprimible: rejilla numerada, símbolos (punto de cruz),
    leyenda con códigos de color y nº de cuentas/puntadas por color."""
    try:
        content = export_pattern(pattern, format)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    media_type = "image/png" if format == "png" else "application/pdf"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="patron.{format}"'},
    )
