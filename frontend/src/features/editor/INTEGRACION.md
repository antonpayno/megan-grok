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
el flujo real (sin fallbacks) de una sola vez.

## Cómo se comporta con el backend

Siempre se llama primero a la API y **solo si responde 501** se usa el respaldo local:

| Necesidad | API | Respaldo |
|---|---|---|
| Paletas | `GET /palettes` | `fallbackPalette.ts` (Hama midi / DMC) |
| Imagen → patrón | `POST /patterns/convert` | `fallbackConvert.ts` (median cut en canvas) |
| Exportar | `POST /patterns/export` | PNG local con `exportLocal.ts`; PDF solo API |
| Publicar | `POST /posts` | `localPosts.ts` (localStorage), navega igual a `/p/:id` |

No hay ningún flag que activar: cuando P2/P3 estén en `main`, los fallbacks dejan de
ejecutarse solos.

## `PatternCanvas` (compartido con P5)

Las props originales no cambian. Nuevas, todas opcionales:
`highlightIndex`, `doneMask`, `boardSize`, `showRulers`, `onRulerPointer`.

## Verificación rápida

```bash
cd frontend && npm run build
# con backend: /create -> subir foto -> editar -> publicar -> /p/:id -> /make/:id
```
