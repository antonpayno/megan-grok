# Prompt P2 — Motor imagen → patrón (rama `feat/engine`)

Lee primero `AGENTS.md` entero: stack, contrato de API, formato `PatternData` y tabla de
propiedad de archivos. Respétala estrictamente.

## Tu rol
Eres responsable del corazón técnico: convertir **una imagen o foto en un patrón** de HAMA o
punto de cruz con colores **reales** de fabricante, simplificándola para que parezca un dibujo
(pocos colores, zonas planas, sin ruido), y de **exportar** el patrón como carta imprimible.

## Archivos que puedes editar
- `backend/app/routers/patterns.py` (las firmas ya existen, no cambies parámetros ni rutas)
- `backend/app/engine/**` (créalos: `palettes.py`, `color.py`, `convert.py`, `export.py`, …)
- `backend/tests/test_engine.py` (nuevo)
- **No toques** nada más. Dependencias ya instaladas: Pillow, NumPy, OpenCV (headless),
  scikit-learn, ReportLab. Si necesitas otra, añádela al final de `requirements.txt` y avísame.

## Fase 1 — MVP (commit al terminar)
1. `engine/palettes.py`: dos paletas como `schemas.Palette`:
   - `hama_midi` (craft `hama`): los colores estándar de Hama midi con su código (`H01` Blanco,
     `H02` Crema, `H03` Amarillo…), ~40-60 colores.
   - `dmc` (craft `cross_stitch`): ~100 hilos DMC habituales con su número (`310` Negro, `B5200`
     Blanco, `321` Rojo…).
   - Los hex son aproximaciones: indícalo en un comentario. Que cubran bien tonos de piel,
     grises, marrones y pasteles (son los que más aparecen en fotos).
   - `GET /api/palettes` devuelve ambas.
2. `engine/color.py`: conversión sRGB → CIELAB vectorizada con NumPy y distancia ΔE
   (CIE76 vale; CIEDE2000 si da tiempo). Todo el emparejamiento de colores se hace **en Lab**, nunca en RGB.
3. `engine/convert.py` — función pura
   `convert_image(data: bytes, craft, width, max_colors, simplify, outline, remove_background, palette_id) -> PatternData`:
   1. Abrir con Pillow, `ImageOps.exif_transpose`, a RGBA; limitar a ~1024 px de lado.
      `height = round(width * h / w)`, acotado a 1..128.
   2. Transparencia: píxeles con alpha < 128 → celda vacía (-1).
   3. **Simplificar a dibujo** según `simplify` (0..3), trabajando a resolución intermedia (≈ width×8):
      0 = nada; 1 = `cv2.bilateralFilter`; 2 = `cv2.pyrMeanShiftFiltering` + bilateral;
      3 = lo anterior más fuerte + un ligero aumento de saturación/contraste.
   4. Reducir a la rejilla: por bloque, color **mediano** (o `INTER_AREA`); máscara de vacío por mayoría.
   5. **Cuantizar**: k-means (`sklearn.cluster.KMeans`, `n_init="auto"`, semilla fija) en Lab con
      `k = max_colors` sobre las celdas no vacías → mapear cada centroide al color más cercano de la
      paleta → deduplicar → reasignar cada celda al más cercano de los elegidos.
   6. **Limpieza**: celdas aisladas (ningún vecino-4 de su color) → color mayoritario de sus vecinas;
      colores con < 0,5 % de celdas se funden con su color más cercano (desde `simplify >= 1`).
   7. Construir `PatternData` cuya paleta contiene **solo los colores usados**, ordenados por
      frecuencia. Para `cross_stitch` asigna `symbol` distinto a cada color de una lista legible
      (`X O + • / \ # @ % & = ~ * ◆ ▲ ■ ● ★ …`).
   - Rendimiento: < 2 s para 128 de ancho. Deja aleatoriedad fija para que sea reproducible.
4. `POST /api/patterns/convert`: lee el archivo (400 si no es imagen o > 10 MB), llama a
   `convert_image` en `run_in_threadpool`, devuelve el `PatternData`. 404 si `palette_id` no existe.
5. CLI para afinar rápido: `python -m app.engine.convert foto.jpg --width 40 --colors 12 --simplify 2`
   que guarda `foto_pattern.png` (previsualización) — úsala para probar con fotos reales y ajustar.

## Fase 2
6. `outline=True`: bordes con Canny sobre la imagen simplificada, reducidos a la rejilla (umbral por
   proporción de píxeles de borde en el bloque), pintados con el color más oscuro de la paleta
   (añádelo si no está). Efecto cómic.
7. `remove_background=True` (si la imagen no trae alpha): estima el color de fondo con los píxeles
   del borde y haz *flood fill* desde los bordes con tolerancia ΔE → esas celdas a -1.
8. `engine/export.py` + `POST /api/patterns/export?format=png|pdf`:
   - PNG (Pillow): rejilla con líneas gruesas cada 10 y numeración de filas/columnas; HAMA como
     círculos con agujero, punto de cruz como cuadros con su símbolo; **leyenda** con muestra,
     código, nombre, símbolo y nº de cuentas/puntadas por color; título "Pixel Pattern".
   - PDF (ReportLab, A4): página 1 = vista previa + leyenda y totales; siguientes = la carta
     troceada en bloques legibles (p.ej. 40×50 celdas por página) con numeración global.
   - Devuelve `Response`/`StreamingResponse` con `Content-Disposition: attachment; filename=patron.<ext>`.
9. Tests en `backend/tests/test_engine.py` (imágenes sintéticas creadas con Pillow en memoria):
   dimensiones correctas y proporción; nº colores ≤ max_colors; todos los colores pertenecen a la
   paleta pedida; PNG con transparencia → celdas -1; una imagen bicolor da exactamente 2 colores;
   el endpoint responde 200 y valida como `PatternData`; export png/pdf devuelve bytes con la
   cabecera correcta (`\x89PNG`, `%PDF`).

## Extra si sobra tiempo
- `dither: bool` (Floyd–Steinberg en Lab) — solo si no rompe la estética "dibujo".
- Ajuste automático del ancho recomendado (p.ej. placas HAMA de 29×29).

## Criterios de aceptación
Una foto de una mascota o un logo simple, con `width=40, max_colors=10, simplify=2`, da un patrón
reconocible, con zonas planas y sin "sal y pimienta". `pytest` en verde.

Trabaja por fases, commits pequeños (`feat(engine): ...`), push a `feat/engine`.
