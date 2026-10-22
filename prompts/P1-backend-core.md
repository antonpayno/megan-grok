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
