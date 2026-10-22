# Capturas para el pitch

Guarda **5 PNG** en `pitch/img/` con estos nombres exactos. El script
`build_pitch.py` los incrusta solo; si falta alguno, deja un placeholder gris.
Cuando estén todos, dime **«capturas listas»** y regenero el `.pptx`.

## Preparación común

1. `cd backend && .venv\Scripts\python.exe -m app.seed --reset` (deja los ids
   estables: `/p/24` es «Gato de pared»).
2. Arranca backend en `:8000` y frontend en `:5173`.
3. Entra como **`lucia` / `demo1234`**.
4. Navegador a 1600 × 900 o 1920 × 1080, zoom 100 %, F11, barra de marcadores
   oculta (`Ctrl+Shift+B`) y notificaciones apagadas.
5. Que no se vean datos personales, la terminal, `app.db` ni la barra de
   tareas. Solo la app.

## Las 5 capturas

| # | Archivo | Diapositiva | URL exacta | Estado que debe verse |
|---|---|---|---|---|
| 1 | `crear.png` | 3 · La solución | `http://localhost:5173/create?remix=24` | Editor con «Gato de pared» cargado, subtítulo «Remix del patrón #24», paleta de 4 colores, barra con deshacer/rehacer y simetría, panel de materiales. Si puedes, activa «Simetría» y pinta dos celdas para que se vea el patrón y el botón activo. |
| 2 | `foto-a-patron.png` | 4 · De foto a patrón | `http://localhost:5173/create` | Tras subir `pitch/demo/fresa-demo.jpg`: original a la izquierda y resultado a la derecha. Ajustes visibles: ancho 48, 12 colores, simplificar «Dibujo», «Quitar fondo» marcado. Que se lea «48 × 48 · 8 colores» y el botón «Editar patrón». |
| 3 | `hacer.png` | 6 · Hazlo tú | `http://localhost:5173/make/24` | Modo hacer con las filas 1–10 marcadas (~31 %), un color seleccionado en «Por color», lista de materiales, «Placas 29×29: 4» y botón PDF. Mejor en ventana ancha para que salga el panel derecho completo. |
| 4 | `feed.png` | 7 · Comunidad | `http://localhost:5173/` | Feed «Explorar» arriba, 2–3 tarjetas de patrones, likes/guardados visibles y layout tipo Instagram. Sin modales ni menús abiertos. |
| 5 | `buscador.png` | 7 · Comunidad | `http://localhost:5173/search?q=corazon` | Buscador con «corazon» escrito y resultados donde aparezca «Corazón pixelado» (sin tilde en la búsqueda). Que se vean también los tags y, si entra en pantalla, algún perfil. |

## Orden recomendado

1. `feed.png` (es la más rápida; solo abrir `/`).
2. `buscador.png` (escribir `corazon`, esperar resultados).
3. `crear.png` (abrir el remix, activar simetría y pintar dos celdas).
4. `foto-a-patron.png` (subir la fresa y ajustar a 48/12/Dibujo).
5. `hacer.png` (marcar filas 1–10 y seleccionar un color).

## Comprobación final

```powershell
Get-ChildItem pitch\img
```

Deben aparecer `crear.png`, `foto-a-patron.png`, `hacer.png`, `feed.png` y
`buscador.png`. Si algún nombre no coincide, el script mostrará el placeholder.
