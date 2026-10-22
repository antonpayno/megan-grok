# Pixel Pattern — contexto para agentes (opencode lee este archivo automáticamente)

App web para crear patrones de **cuentas HAMA** y **punto de cruz** dibujando punto a punto
o a partir de una imagen/foto (que se simplifica a "dibujo" con pocos colores reales),
y una **red social tipo Instagram**: feed, perfiles, likes, guardados, comentarios y
**buscador** de perfiles, patrones y tags. Cualquiera puede abrir un patrón y "hacerlo".

Somos 5 personas, cada una en su rama. **La regla nº 1 es no tocar archivos de otro.**
Así el merge final es limpio.

## Stack

- **backend/**: Python 3.11+, FastAPI, SQLModel + SQLite, PyJWT, Pillow, NumPy, OpenCV, scikit-learn, ReportLab.
- **frontend/**: React 18 + TypeScript + Vite + Tailwind v4 + react-router-dom v6 + lucide-react.
- Interfaz en **español**. Código e identificadores en inglés.

## Arrancar

```bash
# backend (terminal 1)
cd backend && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload            # http://localhost:8000/docs
python -m app.seed                       # datos de demo (cuando exista)

# frontend (terminal 2)
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxy /api y /media -> :8000)
VITE_MOCKS=1 npm run dev                    # con datos falsos (src/api/mocks.ts) si el backend aún no está
```

Tests backend: `cd backend && pytest`. Comprobación frontend: `cd frontend && npm run build`.

## Propiedad de archivos (quién puede editar qué)

| Persona | Rama | Archivos que le pertenecen |
|---|---|---|
| P1 Backend core + integración | `feat/backend-core` | `backend/app/routers/auth.py`, `backend/app/routers/users.py`, `backend/app/seed.py`, `backend/tests/test_auth_users.py`, `README.md` |
| P2 Motor de patrones | `feat/engine` | `backend/app/routers/patterns.py`, `backend/app/engine/**`, `backend/tests/test_engine.py` |
| P3 Backend social | `feat/backend-social` | `backend/app/routers/posts.py`, `backend/app/routers/search.py`, `backend/app/services/**`, `backend/tests/test_posts_search.py` |
| P4 Editor y "hacer patrón" | `feat/editor` | `frontend/src/pages/CreatePage.tsx`, `frontend/src/pages/MakePage.tsx`, `frontend/src/features/editor/**`, `frontend/src/components/pattern/**` |
| P5 Frontend social | `feat/social-ui` | `frontend/src/pages/{Feed,Search,Profile,PostDetail,Login,Register}Page.tsx`, `frontend/src/features/social/**`, `frontend/src/components/Layout.tsx`, `frontend/src/components/ui/**`, `frontend/src/auth/**`, `frontend/src/index.css` |

**Archivos compartidos (CONGELADOS)** — no se tocan salvo acuerdo del equipo, y si se tocan
es en un commit pequeño aparte, avisando:
`backend/app/{main,models,schemas,deps,db,security,config}.py`, `backend/requirements.txt`,
`backend/tests/conftest.py` (fixtures `client`, `session`, `make_user`),
`frontend/src/api/{types,client,mocks}.ts`, `frontend/src/App.tsx`, `frontend/src/main.tsx`,
`frontend/package.json`, `frontend/vite.config.ts`, `AGENTS.md`.

- ¿Necesitas una dependencia nueva? Añádela al **final** de `requirements.txt` / `package.json` y avisa.
- ¿Necesitas código de otra persona que aún no existe? Usa los **mocks** o un stub en TU carpeta. Nunca edites su archivo.
- ¿Componente UI reutilizable? Ponlo en tu propia carpeta (`features/editor/` o `features/social/`).

## Formato central: `PatternData`

Definido en `backend/app/schemas.py` y `frontend/src/api/types.ts` (deben coincidir siempre).

```ts
{ craft: "hama" | "cross_stitch",
  width, height,                     // 1..128
  palette: [{ id: "H01", name: "Blanco", hex: "#FFFFFF", symbol?: "O" }],  // máx. 64
  cells: number[] }                  // row-major: cells[y*width+x] = índice en palette, -1 = vacío
```

La paleta del patrón contiene **solo los colores usados** (subconjunto de una paleta real: Hama midi o DMC).
Para pintar un patrón en cualquier sitio usa `components/pattern/PatternCanvas.tsx`.

## API (todo bajo `/api`, auth con `Authorization: Bearer <token>`)

Las firmas exactas están ya escritas como stubs (devuelven 501) en `backend/app/routers/*.py`
y el cliente tipado completo en `frontend/src/api/client.ts`. Ver `http://localhost:8000/docs`.

| Método y ruta | Devuelve | Dueño |
|---|---|---|
| `POST /auth/register` · `POST /auth/login` · `GET /auth/me` | `TokenOut` / `UserPublic` | P1 |
| `GET /users/{username}` · `PATCH /users/me` · `POST /users/me/avatar` | `UserProfile` | P1 |
| `POST|DELETE /users/{username}/follow` · `GET /users/{username}/followers|following` | `FollowOut` / `UserPublic[]` | P1 |
| `GET /palettes` | `Palette[]` | P2 |
| `POST /patterns/convert` (multipart: file, craft, width, max_colors, simplify, outline, remove_background, palette_id) | `PatternData` | P2 |
| `POST /patterns/export?format=png|pdf` (body `PatternData`) | archivo | P2 |
| `GET /posts/feed?mode=explore|following&cursor=` · `GET /posts?author=&tag=&craft=` · `GET /posts/saved` | `FeedPage` | P3 |
| `POST /posts` · `GET /posts/{id}` · `DELETE /posts/{id}` | `PostOut` | P3 |
| `POST|DELETE /posts/{id}/like` · `POST|DELETE /posts/{id}/save` | `LikeOut` / `SaveOut` | P3 |
| `GET|POST /posts/{id}/comments` | `CommentOut[]` / `CommentOut` | P3 |
| `GET /search?q=&type=all|users|posts&craft=` · `GET /search/tags/trending` | `SearchResults` / `TagCount[]` | P3 |

Paginación: `cursor` = id del último post recibido; `next_cursor: null` = no hay más. Orden: id descendente.

## Rutas del frontend (ya registradas en `App.tsx`)

`/` feed (P5) · `/search` (P5) · `/u/:username` perfil (P5) · `/p/:id` detalle (P5) ·
`/login` `/register` (P5) · `/create` y `/create?remix=<postId>` editor (P4) · `/make/:id` modo hacer (P4).

## Convenciones

- Commits pequeños y frecuentes: `feat(engine): ...`, `fix(feed): ...`. Push a tu rama cada ~30-45 min.
- Antes de cada push: backend `pytest` pasa / frontend `npm run build` sin errores.
- Estilo visual: colores `brand`, `ink`, `paper` de `index.css` (clases `bg-brand`, `text-ink`…). Mobile-first.
- Errores de la API: `ApiError` (status + mensaje). Muéstralos al usuario, no los tragues.
- No subir `app.db`, `media/`, `node_modules/`, `.venv/`.
