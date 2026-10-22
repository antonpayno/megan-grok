# Prompt P5 — Frontend social: feed, perfiles, búsqueda y auth (rama `feat/social-ui`)

Lee primero `AGENTS.md` entero: stack, contrato de API, formato `PatternData` y tabla de
propiedad de archivos. Respétala estrictamente.

## Tu rol
Eres responsable de la cara de la app tipo **Instagram**: layout y navegación, login/registro,
feed, detalle de publicación, perfiles y el **buscador** de perfiles, patrones y tags.
También del estilo visual global.

## Archivos que puedes editar
- `frontend/src/pages/{FeedPage,SearchPage,ProfilePage,PostDetailPage,LoginPage,RegisterPage}.tsx`
- `frontend/src/features/social/**` (tus componentes y hooks: `PostCard`, `PostGrid`, …)
- `frontend/src/components/Layout.tsx`, `frontend/src/components/ui/**` (Button, Avatar, Modal,
  Spinner, Tabs, Input… — P4 también los puede importar, así que mantenlos genéricos y estables)
- `frontend/src/auth/**` (puedes mejorar `AuthContext`, pero **sin cambiar la interfaz de `useAuth()`**)
- `frontend/src/index.css` (tokens de diseño: puedes añadir, no renombres los existentes)
- **No toques** nada más. Para pintar patrones usa `components/pattern/PatternCanvas.tsx` (de P4)
  con `fit` para miniaturas. Llamadas a la API solo vía `api` de `src/api/client.ts`.
- Mientras el backend no esté: `src/api/mocks.ts` (`mockFeed()`, `mockPost()`) con
  `import.meta.env.VITE_MOCKS`.

## Fase 1 — MVP (commit al terminar)
1. **Layout**: barra superior en escritorio (logo, buscador rápido, Crear, avatar con menú: perfil,
   guardados, salir) y **barra inferior en móvil** (Inicio, Buscar, Crear "+", Perfil).
   Componentes base en `components/ui/`.
2. **Login / Registro**: formularios con validación, errores de la API visibles (`ApiError.message`),
   botón con estado de carga, y redirección a `?next=` o `/`. Si ya hay sesión, redirige.
3. **Feed** (`/`): pestañas **Explorar** y **Siguiendo** (esta solo con sesión).
   - `PostCard`: cabecera (avatar + @usuario → perfil), miniatura con `PatternCanvas fit` en un
     contenedor cuadrado centrado con fondo neutro, insignia "HAMA" / "Punto de cruz", título,
     tamaño (p.ej. "29×29 · 8 colores"), acciones: ❤️ like (optimista, revierte si falla),
     💬 comentarios (→ detalle), 🔖 guardar (optimista), botón **"Hacerlo"** → `/make/:id`.
   - Scroll infinito con `IntersectionObserver` y `next_cursor`. Skeletons al cargar,
     estados vacíos con llamada a la acción ("Sigue a gente" / "Crea tu primer patrón").
   - Sin sesión, like/guardar redirigen a `/login?next=...`.
4. **Detalle** (`/p/:id`): patrón grande con `showGrid`, autor (+ botón seguir), descripción, tags
   clicables (→ `/search?q=%23tag`), likes, guardar, comentarios (lista + formulario), botones
   **"Hacer este patrón"** (`/make/:id`), **"Remix"** (`/create?remix=:id`), "Descargar PNG"
   (`api.exportPattern` + `downloadBlob`), "Eliminar" si eres el autor (con confirmación).
   Si `remix_of`, enlace "Remix de …".

## Fase 2
5. **Perfil** (`/u/:username`): avatar, nombre, @usuario, bio, contadores (patrones, seguidores,
   seguidos — los dos últimos abren un modal con la lista), botón Seguir/Siguiendo (optimista) o
   "Editar perfil" si `is_me` (modal: nombre, bio, subir avatar con `api.uploadAvatar`).
   Pestañas **Patrones** (rejilla 3 columnas tipo Instagram, scroll infinito con `api.listPosts`)
   y **Guardados** (solo si `is_me`, `api.savedPosts`). 404 bonito si no existe.
6. **Buscador** (`/search`): input con *debounce* 300 ms sincronizado con `?q=` en la URL;
   pestañas Todo / Perfiles / Patrones; filtro por técnica (chips); resultados: filas de usuario,
   rejilla de patrones y chips de tags (clic → busca `#tag`). Con la caja vacía: **tags en
   tendencia** (`api.trendingTags`) y búsquedas recientes (`localStorage`, borrables).
   El buscador rápido del layout navega a `/search?q=`.
7. Pulido: transiciones suaves, foco accesible, `title` de la pestaña por página, toasts de error,
   favicon. Estética cuidada y coherente (tokens `brand`, `ink`, `paper`, iconos `lucide-react`).

## Criterios de aceptación
`npm run build` sin errores de TypeScript. Con el seed de P1: el feed carga con scroll infinito,
like/guardar/seguir funcionan y persisten al recargar, la búsqueda encuentra perfiles, patrones y
tags (también sin acentos), y todo es usable en un móvil.

Trabaja por fases, commits pequeños (`feat(feed): ...`), push a `feat/social-ui`.
