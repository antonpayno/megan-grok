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
