# Pitch de Pixel Pattern

Presentación de 11 diapositivas en 16:9 para el hackathon. Se genera con
[python-pptx](https://python-pptx.readthedocs.io/) a partir de `build_pitch.py`.

```bash
# desde la raíz del repo, en Windows
backend\.venv\Scripts\python.exe pitch\build_pitch.py
```

Genera `pitch/pixel-pattern-pitch.pptx`. `python-pptx` está instalado solo en el
venv; no se añade a `requirements.txt`.

## Capturas

Guarda los PNG en `pitch/img/` con estos nombres exactos y vuelve a ejecutar el
script. Se incrustan solas. Si falta alguna, la diapositiva muestra un recuadro
gris con el texto `Captura: <nombre>`.

| Archivo | Diapositiva | Pantalla | Qué conviene que se vea |
|---|---|---|---|
| `crear.png` | 3 · La solución | `/create` | Editor con un patrón cargado, la paleta a un lado y las herramientas de edición. |
| `foto-a-patron.png` | 4 · De foto a patrón | `/create`, después de subir una foto | La foto original, el patrón generado y la paleta real Hama/DMC. Que se entienda el antes → después. |
| `hacer.png` | 6 · Hazlo tú | `/make/:id` | Patrón abierto en modo hacer, con progreso marcado, modo por color, lista de materiales, nº de placas y botón de PDF. |
| `feed.png` | 7 · Comunidad | `/` | Feed con 2–3 patrones, likes/guardados visibles y el layout tipo Instagram. |
| `buscador.png` | 7 · Comunidad | `/search` | Búsqueda de `#gato` (o `gato`) con resultados de perfiles, patrones y tags. |

Recomendaciones:

- PNG en horizontal, 1600 × 900 o 1920 × 1080. Mejor sin barra del navegador ni
  barra de tareas: solo la vista de la app.
- Tema claro, zoom al 100 %, datos de demo (`python -m app.seed` si existe) y
  sin información personal.
- El script respeta la proporción de la imagen y la centra dentro de la tarjeta,
  así que también funcionan capturas algo más altas o más anchas.

## Textos que hay que sustituir

En la portada y el cierre:

- `[Nombre del hackathon]`
- `[Nombre del equipo]`
- `[enlace a la demo]`
- `[QR / enlace a la demo]` (recuadro punteado; se puede pegar un QR encima en
  PowerPoint)

## Diseño y contenido

- Fondo `#FBF8F4`, texto `#1F1D2B`, acento `#E8456B`, fuente Segoe UI.
- 11 diapositivas, ideas muy cortas y mucho aire.
- Notas del orador en español en cada diapositiva, con un tiempo orientativo.
  El total está pensado para 4–5 minutos.
- El corazón pixelado de la portada y el cierre está dibujado con formas, no es
  una imagen.

## Regenerar tras cambiar textos o capturas

```bash
backend\.venv\Scripts\python.exe pitch\build_pitch.py
```

El script imprime al final qué capturas encuentra y cuáles siguen en modo
placeholder.
