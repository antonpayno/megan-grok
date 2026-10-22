# P4 · Editor y modo "hacer" — notas de integración

Todo lo de esta carpeta es de P4. Archivos que edita esta rama:
`pages/CreatePage.tsx`, `pages/MakePage.tsx`, `components/pattern/PatternCanvas.tsx`
y `features/editor/**`. No toca archivos congelados ni dependencias.

## Merge

Orden recomendado (no hay solape de archivos con nadie, así que no hay conflictos):

1. `feat/engine` (P2)
2. `ander` (P3)
3. `feat/editor` (P4)
4. `branch_nico` (P5)

`feat/editor` ya contiene `origin/main`. Mergear después de P2/P3 permite comprobar
el flujo real (API primero, respaldos solo si falla) de una sola vez.

## Cómo se comporta con el backend

Siempre se llama primero a la API. No quedan flags `VITE_MOCKS` ni publicaciones locales.

| Necesidad | API | Respaldo |
|---|---|---|
| Paletas | `GET /palettes` | `fallbackPalette.ts` (Hama midi / DMC) |
| Imagen → patrón | `POST /patterns/convert` | `fallbackConvert.ts` (median cut en canvas), **solo si la API falla** y con aviso visible |
| Exportar | `POST /patterns/export` | PNG local con `exportLocal.ts`; PDF solo API |
| Publicar | `POST /posts` | Sin respaldo: el error se muestra en el diálogo |

La conversión usa `useImageConversion.ts`: debounce de 450 ms, una sola petición en vuelo
y descarte de respuestas viejas.

## `PatternCanvas` (compartido con P5)

Las props originales no cambian. Nuevas, todas opcionales:
`highlightIndex`, `doneMask`, `boardSize`, `showRulers`, `onRulerPointer`.

El dibujo usa capas fuera de pantalla (celdas, rejilla, hechas, resaltado) y solo
repite las celdas que cambian. En `/make` el trazo se interpola con Bresenham para
que arrastrar rápido no deje huecos. Probado a 128×128 manteniendo ~60 fps.

## Verificación rápida

```bash
cd frontend && npm run build
# con backend: /create -> subir foto -> editar -> publicar -> /p/:id -> /make/:id
```
