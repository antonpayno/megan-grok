"""PROPIETARIO: Persona 2 (motor de patrones). Solo Persona 2 edita este archivo
y todo lo que hay en app/engine/."""
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..schemas import Craft, Palette, PatternData

router = APIRouter()


@router.get("/palettes", response_model=list[Palette])
def list_palettes():
    """Todas las paletas disponibles (al menos 'hama_midi' y 'dmc')."""
    raise HTTPException(501, "TODO Persona 2")


@router.post("/patterns/convert", response_model=PatternData)
async def convert(
    file: UploadFile = File(...),
    craft: Craft = Form("hama"),
    width: int = Form(29, ge=4, le=128),     # alto = proporcional a la imagen
    max_colors: int = Form(12, ge=2, le=64),
    simplify: int = Form(2, ge=0, le=3),     # 0 = fiel a la foto … 3 = muy "dibujo"
    outline: bool = Form(False),              # contorno oscuro estilo cartoon
    remove_background: bool = Form(False),    # fondo -> celdas vacías (-1)
    palette_id: str | None = Form(None),      # por defecto: hama_midi o dmc según craft
):
    """Imagen/foto -> PatternData simplificado y mapeado a colores reales de la paleta."""
    raise HTTPException(501, "TODO Persona 2")


@router.post("/patterns/export")
def export(pattern: PatternData, format: Literal["png", "pdf"] = "png"):
    """Devuelve la carta imprimible: rejilla numerada, símbolos (punto de cruz),
    leyenda con códigos de color y nº de cuentas/puntadas por color."""
    raise HTTPException(501, "TODO Persona 2")
