# Prompt P4 — Frontend: editor de patrones y modo "hacer" (rama `feat/editor`)

Lee primero `AGENTS.md` entero: stack, contrato de API, formato `PatternData` y tabla de
propiedad de archivos. Respétala estrictamente.

## Tu rol
Eres responsable de la parte creativa del frontend: **crear un patrón** (desde una imagen o
dibujando punto a punto), editarlo, exportarlo y publicarlo; y la pantalla **"Hacer este patrón"**
que se usa mientras montas las cuentas o bordas.

## Archivos que puedes editar
- `frontend/src/pages/CreatePage.tsx`, `frontend/src/pages/MakePage.tsx`
- `frontend/src/features/editor/**` (todos tus componentes, hooks y utilidades)
- `frontend/src/components/pattern/**` (`PatternCanvas.tsx` es tuyo: puedes mejorarlo, pero **sus
  props actuales deben seguir funcionando**; solo añade props opcionales — P5 lo usa en el feed)
- **No toques** nada más. Usa `api` de `src/api/client.ts`, tipos de `src/api/types.ts`,
  `useAuth()` de `src/auth/AuthContext.tsx`. Componentes UI genéricos de P5 en `src/components/ui/`
  puedes importarlos si ya existen; si no, haz los tuyos en `features/editor/`.
- Mientras el backend no esté: `src/api/mocks.ts` (`mockPattern()`), y una paleta temporal en
  `features/editor/fallbackPalette.ts`. Cuando `api.palettes()` / `api.convertImage()` funcionen, úsalos.

## Fase 1 — MVP (commit al terminar)
1. `features/editor/usePatternEditor.ts` — hook con el estado del patrón:
   herramientas lápiz, goma, cubo (flood fill 4-vecinos), cuentagotas; color activo;
   **deshacer/rehacer** (pila de 50, un paso por trazo completo, no por celda; Ctrl+Z / Ctrl+Shift+Z);
   simetría horizontal opcional; redimensionar lienzo; añadir/quitar colores de la paleta del patrón
   (al quitar uno, sus celdas pasan a -1 y se reindexa `cells`). Mantén `PatternData` siempre válido.
2. `CreatePage` (`/create`), flujo en pasos:
   - **Elegir**: técnica (HAMA / Punto de cruz) y origen: "Desde imagen" o "En blanco" con tamaños
     predefinidos (HAMA: 29×29 placa cuadrada, 15×15, 58×58; Punto de cruz: 30×30, 50×50, 80×80).
   - **Desde imagen**: arrastrar/soltar, botón subir, y cámara en móvil (`accept="image/*"`).
     Controles: ancho (4-128), nº de colores (2-64), "Simplificar" (0-3: Foto → Dibujo), contorno,
     quitar fondo. Vista lado a lado original / resultado, reconversión con *debounce* (400 ms) al
     mover controles, spinner y errores visibles. Botón "Editar" → pasa al editor.
   - **Editor**: `PatternCanvas` con rejilla, zoom (botones y rueda), desplazamiento, barra de
     herramientas y selector de color (paleta del patrón + "añadir color" desde la paleta completa
     de `api.palettes()` filtrada por técnica). Funciona con ratón y táctil (pointer events).
   - **Publicar**: diálogo con título, descripción, tags (chips, Enter para añadir) →
     `api.createPost` → `navigate("/p/" + id)`. Sin sesión: guarda el borrador y redirige a
     `/login?next=/create`.
   - **Borrador** autoguardado en `localStorage` (no pierdas el trabajo al recargar).
3. Lista de **materiales** junto al editor: por color, muestra + código + nombre + cantidad, total;
   en HAMA, nº de placas de 29×29 necesarias.

## Fase 2
4. `/create?remix=<id>`: carga `api.getPost(id).pattern` en el editor y publica con `remix_of`.
5. Exportar: botones "PNG" y "PDF" → `api.exportPattern` + `downloadBlob`. Mientras el backend no lo
   tenga, PNG local con `canvas.toBlob` como alternativa.
6. `MakePage` (`/make/:id`) — el modo que se usa al hacer el patrón:
   - Patrón grande con zoom y numeración de filas/columnas (cada 5 y 10).
   - **Modo por color**: al pulsar un color de la leyenda se atenúan los demás.
   - Marcar celdas hechas (tocar o arrastrar) y "marcar fila"; progreso en % y por color;
     estado guardado en `localStorage` por post; botón reiniciar.
   - Punto de cruz: símbolos en las celdas (`showSymbols`). HAMA: líneas de separación de placas cada 29.
   - Lista de materiales con checkboxes ("ya lo tengo"). Botones descargar PDF y "Remix".
7. Mejoras de `PatternCanvas` (solo props **opcionales** nuevas): `highlightIndex`, `doneMask`,
   `boardSize`, `showRulers`. Asegura buen rendimiento a 128×128 (redibuja solo lo necesario o usa
   un canvas fuera de pantalla para la base).

## Diseño
Usa los tokens `brand`, `ink`, `paper` de `index.css` y `lucide-react` para iconos. Mobile-first:
en móvil, herramientas en barra inferior y paneles plegables. Que se vea bonito: es lo que más
luce en la demo.

## Criterios de aceptación
`npm run build` sin errores de TypeScript. Flujo completo: subir foto → ajustar → editar unas
cuentas → deshacer → publicar → aparece en `/p/:id`. `/make/:id` recuerda el progreso al recargar.

Trabaja por fases, commits pequeños (`feat(editor): ...`), push a `feat/editor`.
