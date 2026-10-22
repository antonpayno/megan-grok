# Prompt P1 — Backend core + integración (rama `feat/backend-core`)

Lee primero `AGENTS.md` entero: ahí está el stack, el contrato de la API, el formato
`PatternData` y la tabla de propiedad de archivos. Respétala estrictamente.

## Tu rol
Eres responsable de **autenticación, usuarios, perfiles, follows y datos de demo** del backend,
y de la **integración final** (merges, README, despliegue de la demo).

## Archivos que puedes editar
- `backend/app/routers/auth.py`, `backend/app/routers/users.py`
- `backend/app/seed.py`, `backend/seed_assets/**` (nueva, opcional)
- `backend/tests/test_auth_users.py` (nuevo)
- `README.md`
- **No toques** ningún otro archivo. Los compartidos (`models.py`, `schemas.py`, `deps.py`,
  `security.py`, `main.py`, `conftest.py`…) ya están hechos: úsalos, no los cambies.
  Si de verdad necesitas cambiar uno, para y pídemelo explicando por qué.

## Fase 1 — MVP (prioridad máxima, haz commit al terminar)
1. `POST /api/auth/register`: normaliza `username` y `email` a minúsculas; 409 con mensaje claro
   ("Ese usuario ya existe" / "Ese email ya está registrado"); validación básica de email;
   `display_name` por defecto = username. Hashea con `security.hash_password`. Devuelve `TokenOut`.
2. `POST /api/auth/login`: acepta username o email. 401 "Usuario o contraseña incorrectos".
3. `GET /api/users/{username}` → `UserProfile` con `followers_count`, `following_count`,
   `posts_count` (cuenta en la tabla `Post`), `is_following` (según `viewer`; False sin sesión),
   `is_me`. 404 si no existe. Usa `select(func.count())` — nada de cargar listas para contar.
4. `PATCH /api/users/me` (solo actualiza los campos no-None; recorta espacios; bio ≤ 300 chars).
5. Follow/unfollow idempotentes (400 si te sigues a ti mismo) devolviendo `FollowOut`.
   `GET /followers` y `/following` → `UserPublic[]` (más recientes primero, máx. 100).

## Fase 2
6. `POST /api/users/me/avatar`: Pillow → EXIF transpose, recorte cuadrado centrado, 256×256,
   guarda en `MEDIA_DIR/avatars/<user_id>.png`, `avatar_url = "/media/avatars/<id>.png?v=<timestamp>"`.
   Rechaza (400) archivos que no sean imagen o > 5 MB.
7. **Seed** (`python -m app.seed [--reset]`): idempotente; `--reset` borra `app.db` y recrea.
   - 8 usuarios de demo con nombres y bios creíbles (contraseña `demo1234`, documéntalo en README),
     grafo de follows variado.
   - ~30 posts válidos según `PatternData` (valida con `schemas.PatternData`). Genera los patrones
     desde **arte ASCII** definido en el propio seed (corazón, estrella, seta, gato, fantasma,
     arcoíris, fresa, cara sonriente, planta, rana… — todo diseños originales, nada de personajes
     con copyright). Mezcla `hama` y `cross_stitch`; tamaños de 12×12 a 40×40;
     paletas con ids/hex tipo Hama ("H01" Blanco #FFFFFF…) y DMC ("310" Negro #000000…).
   - Tags variados (gato, kawaii, navidad, comida, naturaleza, retro, pixelart, flores…),
     likes y comentarios repartidos, `created_at` escalonado en los últimos 10 días.
   - Inserta directamente con los modelos (no dependas de los routers de otros).
   - Si existe `app.engine.convert` (de P2) y hay imágenes en `backend/seed_assets/`, conviértelas
     también — envuelto en try/except para que el seed funcione aunque el motor no esté.
8. Tests en `backend/tests/test_auth_users.py` con las fixtures `client`, `make_user` de `conftest.py`:
   registro, duplicados, login por email y username, perfil con contadores, follow/unfollow idempotente.

## Fase 3 — integración (en los checkpoints de README.md)
- Mergea a `main` en el orden de README.md, ejecuta `pytest` y `npm run build` tras cada merge,
  y arregla lo que rompa **avisando al dueño** del archivo.
- Al final: reescribe `README.md` como README del proyecto (qué es, capturas, cómo arrancar,
  usuarios demo, arquitectura en 5 líneas, equipo).
- Opcional si sobra tiempo: que FastAPI sirva `frontend/dist` para tener un solo proceso en la demo
  (requiere tocar `main.py`: hazlo tú como integrador, en un commit aparte y avisando).

## Criterios de aceptación
- `pytest` en verde. En `/docs` todos los endpoints de auth/users funcionan.
- Tras `python -m app.seed --reset`, el feed y los perfiles tienen contenido realista.
- Nunca se devuelve `password_hash` ni `email` de otros usuarios.

Trabaja por fases, haz commits pequeños (`feat(auth): ...`) y push a `feat/backend-core`.
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
# Prompt P3 — Backend social: posts, feed y búsqueda (rama `feat/backend-social`)

Lee primero `AGENTS.md` entero: stack, contrato de API, formato `PatternData` y tabla de
propiedad de archivos. Respétala estrictamente.

## Tu rol
Eres responsable de la parte "Instagram" del backend: publicar patrones, feed, likes,
guardados, comentarios y el **buscador** (perfiles, patrones y tags).

## Archivos que puedes editar
- `backend/app/routers/posts.py`, `backend/app/routers/search.py` (firmas ya escritas: no cambies
  rutas, parámetros ni modelos de respuesta)
- `backend/app/services/**` (créalo: `posts.py`, `text.py`, …)
- `backend/tests/test_posts_search.py` (nuevo)
- **No toques** nada más (`models.py`, `schemas.py`, `deps.py`, `conftest.py` son compartidos).
  Usa `from ..deps import SessionDep, CurrentUser, OptionalUser`.
  Para tests: fixtures `client`, `session`, `make_user` de `conftest.py` (crean usuarios directo en BD,
  no dependes de que P1 haya terminado el registro).

## Fase 1 — MVP (commit al terminar)
1. `services/text.py`:
   - `normalize(s)`: minúsculas, sin acentos (unicodedata NFKD), espacios colapsados.
   - `normalize_tags(list[str]) -> list[str]`: quita `#`, normaliza, únicos, máx. 10, 1-30 chars.
   - Guarda en `Post.tags` como `",gato,kawaii,"` (comas en los extremos, ver `models.py`).
   - Registra una función SQLite `unaccent()` con `@event.listens_for(engine, "connect")`
     (importando `engine` de `app.db`) para búsquedas sin acentos.
2. `services/posts.py` — `build_post_outs(session, posts, viewer) -> list[PostOut]`:
   **sin N+1**: con la lista de ids haz una consulta agrupada para likes, otra para comentarios,
   otra para `liked_by_me`/`saved_by_me` del viewer y otra para los autores. Úsala en TODOS los endpoints.
3. `POST /api/posts`: guarda `pattern` (dict de `PatternData`), `width`, `height`,
   `colors_count` (= nº índices distintos ≠ -1), tags normalizados; `remix_of` debe existir (404 si no).
4. `GET /api/posts/{id}` (404), `DELETE` (solo autor, 403; borra también likes, saves y comentarios).
5. `GET /api/posts/feed`: `explore` = todos; `following` = autores que sigo + yo (401 sin sesión).
   Paginación por cursor: `id < cursor`, orden `id desc`, `limit` acotado a 1..50,
   `next_cursor` = id del último si hay más, si no `None`.
6. `GET /api/posts?author=&tag=&craft=` (author = username, 404 si no existe) y `GET /api/posts/saved`.
7. Like/unlike y save/unsave **idempotentes** (sin errores de clave duplicada), devuelven el estado
   y el contador actualizado.
8. Comentarios: listar (más antiguos primero, máx. 200) y crear (texto recortado, 1-500 chars).

## Fase 2 — búsqueda
9. `GET /api/search?q=`:
   - `q` normalizado; vacío → resultados vacíos. Si empieza por `#` → solo tag exacto.
   - **users**: coincide en `username` o `display_name` (con `unaccent(lower(...)) LIKE`), primero
     los que empiezan por `q`, luego por nº de seguidores. Máx. `limit`.
   - **posts**: coincide en título, descripción o tags. Puntuación: tag exacto > título empieza por >
     título contiene > tag contiene > descripción; desempate por likes y luego más reciente.
     Filtro opcional `craft`. Puedes traer candidatos con SQL y puntuar en Python (la BD es pequeña).
   - **tags**: tags existentes que contienen `q` con su nº de posts (máx. 10).
   - `type=users|posts` deja vacías las otras listas.
10. `GET /api/search/tags/trending`: tags más usados en los posts de los últimos 14 días
    (si hay pocos, de todos), con `count`. Calcula en Python, es suficiente.
11. Tests en `backend/tests/test_posts_search.py`: crear post válido / inválido (cells de longitud
    incorrecta → 422), feed explore y following con paginación (crea 25 posts, recorre páginas),
    like idempotente y contador, borrar post ajeno → 403, búsqueda sin acentos ("corazon" encuentra
    "Corazón"), `#tag` exacto, trending.

## Extra si sobra tiempo
- `mode=explore` mezclando recientes con populares (likes de las últimas 48 h) — sin cambiar el contrato.
- Sugerencias: posts del mismo tag en el detalle (solo si P5 lo pide; requeriría endpoint nuevo
  acordado y añadido a `schemas.py`/`types.ts` por ambos).

## Criterios de aceptación
`pytest` en verde; con el seed de P1, `/api/posts/feed` responde en < 200 ms; nunca se filtra
email ni `password_hash` de autores (usa `UserPublic`).

Trabaja por fases, commits pequeños (`feat(posts): ...`), push a `feat/backend-social`.
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
