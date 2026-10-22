# Pitch de Pixel Pattern

Presentación de 11 diapositivas en 16:9 para el hackathon. Se genera con
[python-pptx](https://python-pptx.readthedocs.io/) a partir de `build_pitch.py`.
El guion de 4–5 minutos, el reparto por personas y la demo paso a paso están en
[`GUION.md`](GUION.md).

```bash
# desde la raíz del repo, en Windows
backend\.venv\Scripts\python.exe pitch\build_pitch.py
```

Genera `pitch/pixel-pattern-pitch.pptx`. `python-pptx` está instalado solo en el
venv; no se añade a `requirements.txt`.

## Datos que aparecen en el deck

| Dato | Valor | De dónde sale |
|---|---|---|
| Tests backend | **76 en verde** | `cd backend && pytest -q` |
| Líneas propias P1–P5 | **10.905** | `git ls-files` + conteo por áreas de `AGENTS.md` |
| Líneas compartidas | **834** | `main/models/schemas/deps/db/security/config`, `api/`, `App.tsx`… |
| Conversión | **0,3–0,6 s a 128 px** | prueba con foto de demo en el motor real |
| Paletas | **60 colores Hama · 190 DMC** | `backend/app/engine/palettes.py` |
| Límites | **128 × 128 celdas · 64 colores** | `backend/app/config.py` |

> Nota: `pytest --collect-only -q` recoge 76 tests. Si en algún momento se añade
> uno más, actualiza también las notas de las diapositivas 8 y 9 y este README.

## Capturas

Guarda los PNG en `pitch/img/` con estos nombres exactos y vuelve a ejecutar el
script. Se incrustan solas. Si falta alguna, la diapositiva muestra un recuadro
gris con el texto `Captura: <nombre>`. La lista paso a paso está en
[`CAPTURAS.md`](CAPTURAS.md).

| Archivo | Diapositiva | URL | Estado que hay que capturar |
|---|---|---|---|
| `crear.png` | 3 · La solución | `/create?remix=24` | Editor con «Gato de pared» cargado, subtítulo «Remix del patrón #24», paleta de 4 colores, barra con deshacer/rehacer y simetría, panel de materiales. Mejor con «Simetría» activa y dos celdas pintadas. |
| `foto-a-patron.png` | 4 · De foto a patrón | `/create`, después de subir `pitch/demo/fresa-demo.jpg` | La foto original a la izquierda y el patrón resultante a la derecha. Ajustes: ancho 48, 12 colores, simplificar «Dibujo», «Quitar fondo» marcado. Que se lean «48 × 48 · 8 colores». |
| `hacer.png` | 6 · Hazlo tú | `/make/24` (Gato de pared) | Modo hacer con las filas 1–10 marcadas (~31 %), un color seleccionado en «Por color», lista de materiales, «Placas 29×29: 4» y botón PDF. |
| `feed.png` | 7 · Comunidad | `/` | Feed «Explorar» con 2–3 patrones, likes/guardados visibles y el layout tipo Instagram. |
| `buscador.png` | 7 · Comunidad | `/search?q=corazon` | Resultados de «corazon»: debe aparecer «Corazón pixelado» aunque no lleve tilde. Si se quiere enseñar tag, usar `/search?q=%23gato`. |

Recomendaciones:

- PNG en horizontal, 1600 × 900 o 1920 × 1080. Mejor sin barra del navegador ni
  barra de tareas: solo la vista de la app.
- Tema claro, zoom al 100 %, datos de demo (`python -m app.seed --reset`) y sin
  información personal. Entra como `lucia` / `demo1234` para que se vea el avatar
  y el perfil reales.
- El script respeta la proporción de la imagen y la centra dentro de la tarjeta,
  así que también funcionan capturas algo más altas o más anchas.
- La foto de demo es [`demo/fresa-demo.jpg`](demo/fresa-demo.jpg), una fresa sobre
  fondo blanco. Se eligió porque el patrón resultante se reconoce muy bien a
  29 × 29 y a 48 × 48. Fuente: Pexels, foto 934066, licencia Pexels (uso libre).

## Textos que hay que sustituir

En la portada y el cierre:

- `[Nombre del hackathon]`
- `[Nombre del equipo]`
- `[enlace a la demo]`
- `[QR / enlace a la demo]` (recuadro punteado; se puede pegar un QR encima en
  PowerPoint)

## Diseño y contenido

- Fondo `#FBF8F4`, texto `#1F1D2B`, acento `#E8456B`, fuente Segoe UI.
- 11 diapositivas, ideas muy cortas y mucho aire. Las notas del orador suman
  unos 4:40.
- Notas del orador en español en cada diapositiva, con un tiempo orientativo y
  los datos reales del proyecto.
- El corazón pixelado de la portada y el cierre está dibujado con formas, no es
  una imagen.
- La diapositiva 9 muestra el reparto real: P1 1.427 líneas, P2 1.534, P3 1.142,
  P4 3.412 y P5 3.390 (sin contar el README de P1 ni los archivos compartidos).

## Regenerar tras cambiar textos o capturas

```bash
backend\.venv\Scripts\python.exe pitch\build_pitch.py
```

El script imprime al final qué capturas encuentra y cuáles siguen en modo
placeholder.
