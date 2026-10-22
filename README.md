# Pixel Pattern 🧩🧵

App web para crear **patrones de cuentas HAMA** y **punto de cruz** dibujando celda a celda o
a partir dunha foto, e compartilos nunha **rede social tipo Instagram**: feed, perfís,
seguidores, likes, gardados, comentarios e buscador de persoas, patróns e tags.

> Interfaz en español. Código e identificadores en inglés.

## Funcionalidades

- **Editor de patróns** punto a punto: pincel, borrar, encher, zoom/pan, paleta real e borrador local.
- **Foto → patrón**: suavizado OpenCV, redución a poucos colores reais, contorno opcional e
  eliminación de fondo; elixe técnica (HAMA / punto de cruz), ancho e número de cores.
- **Exportación** do patrón a **PNG** e **PDF** coa carta de cores e material.
- **Modo “facer este patrón”**: marca as celas xa feitas, progreso gardado e lista de material.
- **Rede social**: feed *explore* e *seguindo*, perfís, seguir/deixar de seguir, likes,
  gardados, comentarios e busca por usuario, patrón ou `#tag`.
- **Auth JWT** con rexistro, login por usuario ou email, avatar (256×256) e edición de perfil.
- **Datos demo** listos en dous minutos (8 usuarios, 30 patróns, follows, likes e comentarios).
- **Demo nun só proceso**: FastAPI serve a SPA compilada e a API no mesmo porto.

## Stack

| Capa | Tecnoloxía |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind v4 + react-router-dom + lucide-react |
| Backend | Python 3.11+ · FastAPI · SQLModel + SQLite · PyJWT · Pillow |
| Motor de imaxe | OpenCV · NumPy · scikit-learn (k-means en CIELAB) · ReportLab |
| Tests | pytest + httpx (backend) · `tsc` + `vite build` (frontend) |

## Arrancar

### Demo (un só proceso)

```powershell
powershell -ExecutionPolicy Bypass -File .\start_demo.ps1
```

O script compila o frontend, libera o porto 8000, executa `python -m app.seed --reset` e
arranca uvicorn en `0.0.0.0:8000`. Logo abre:

- App: **http://localhost:8000**
- API docs: **http://localhost:8000/docs**

### Desenvolvemento (dous procesos)

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed --reset
uvicorn app.main:app --reload   # http://localhost:8000/docs

# Terminal 2 — frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxy /api e /media)
```

O seed é idempotente: sen `--reset` só actúa se a base de datos está baleira.

## Usuarios demo

Todos coa contrasinal **`demo1234`**.

| Usuario | Nome | Perfil |
|---|---|---|
| `lucia` | Lucía Ferro | HAMA, gatos e kawaii |
| `mario` | Mario Souto | Punto de cruz retro |
| `noa` | Noa Pena | Animaliños en pixel |
| `hugo` | Hugo Varela | Fantasmas, setas e 8 bits |
| `ivan` | Iván Ríos | Plantas e flores |
| `alma` | Alma Cid | Fresas, arcoíris e cor |
| `xiana` | Xiana Bouzas | Arcoíris grandes en HAMA |
| `breogan` | Breogán Areas | Patróns xeométricos e estrelas |

## Arquitectura (5 liñas)

1. **SPA React** con rutas de React Router; en demo servea FastAPI desde `frontend/dist`.
2. **API REST FastAPI** baixo `/api`, autenticación JWT e SQLite/SQLModel como persistencia.
3. **Motor de imaxe**: suavizado OpenCV → k-means en CIELAB → paletas reais Hama/DMC → `PatternData`.
4. **`PatternData`** (craft, width, height, palette, cells) é o contrato único entre motor, API e UI.
5. **Media local** (`media/avatars`) e seed determinista para que a demo teña contido realista.

## Estrutura

```
.
├── backend/
│   ├── app/
│   │   ├── engine/        # conversión imaxe → patrón, paletas e export
│   │   ├── routers/       # auth, users, patterns, posts, search
│   │   ├── services/      # lóxica de posts, busca e texto
│   │   ├── main.py        # API + SPA compilada
│   │   ├── models.py      # User, Post, Follow, Like, Save, Comment
│   │   ├── schemas.py     # contrato da API e PatternData
│   │   └── seed.py        # datos demo
│   ├── tests/
│   └── seed_assets/       # imaxes opcionais para o seed
├── frontend/
│   └── src/
│       ├── api/           # cliente tipado e tipos
│       ├── auth/
│       ├── components/    # Layout, PatternCanvas, ui
│       ├── features/      # editor e social
│       └── pages/
├── pitch/
├── start_demo.ps1
├── AGENTS.md              # contexto técnico para agentes
└── PROMPTS.md             # reparto e prompts do equipo
```

## Tests

```bash
cd backend && pytest            # API, motor, seed e integración
cd frontend && npm run build    # type-check + build de produción
```

## Equipo

| Rol | Persoa |
|---|---|
| P1 · Backend core + integración | `<nome P1>` |
| P2 · Motor imaxe → patrón | `<nome P2>` |
| P3 · Backend social | `<nome P3>` |
| P4 · Editor e modo facer | `<nome P4>` |
| P5 · Frontend social | `<nome P5>` |

---

Feito nun hackathon. Os patróns do seed son deseños orixinais; as paletas Hama e DMC son
referencias de cor dos fabricantes.
