# Desplegar Pixel Pattern

A app xa está preparada para correr nun só proceso: FastAPI serve a API e mais a SPA
compilada. O `Dockerfile` compila o frontend e deixa todo listo.

> Importante: o plano gratuíto de Render non ten disco persistente. A base de datos
> SQLite reséase en cada redeploy/reinicio. Para que os datos sobrevivan hai que usar
> un disco (plan de pago) ou un volume de Railway/Fly.

## Opción A — Render (recomendada)

1. Abre o blueprint: <https://render.com/deploy?repo=https://github.com/antonpayno/megan-grok>
2. Entra con GitHub e aplica o blueprint (`render.yaml`).
3. Render compila o `Dockerfile` e publica unha URL tipo
   `https://pixel-pattern-xxxx.onrender.com`.

O blueprint xa xera `SECRET_KEY`. Para persistencia, edita `render.yaml`:

```yaml
plan: starter
disk:
  name: data
  mountPath: /data
  sizeGB: 1
envVars:
  - key: DATABASE_URL
    value: sqlite:////data/app.db
  - key: MEDIA_DIR
    value: /data/media
```

## Opción B — Railway

1. New Project → Deploy from GitHub repo → `antonpayno/megan-grok`.
2. Railway detecta o `Dockerfile`.
3. Variables: `SECRET_KEY` (longa e aleatoria), `DATABASE_URL=sqlite:////data/app.db`,
   `MEDIA_DIR=/data/media`.
4. Engade un volume montado en `/data` e xera un dominio público.

## Opción C — Fly.io

```bash
fly launch --dockerfile Dockerfile --no-deploy
fly volumes create data --size 1
fly secrets set SECRET_KEY="cambia-isto"
fly deploy
```

Con volume, define `DATABASE_URL=sqlite:////data/app.db` e `MEDIA_DIR=/data/media`.

## Opción D — GitHub Codespaces (temporal, cota gratuíta)

Serve para compartir unha URL mentres o codespace estea aceso.

```bash
gh auth refresh -h github.com -s codespace
gh codespace create -R antonpayno/megan-grok -m basicLinux32gb --idle-timeout 4h
gh codespace ssh -c <nome-do-codespace>
```

Dentro do codespace:

```bash
cd /workspaces/megan-grok/backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cd ../frontend && npm ci && npm run build
cd ../backend && python -m app.seed --reset
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
```

E desde a túa máquina:

```bash
gh codespace ports visibility 8000:public -c <nome-do-codespace>
```

URL: `https://<nome>-8000.app.github.dev`. O codespace párase por inactividade;
podes reinicialo con `gh codespace start -c <nome>`.

## Túneles locais (non dispoñibles nesta rede)

Cloudflare Quick Tunnel necesita saída UDP/TCP ao porto 7844; nesta rede está
bloqueado. `localhost.run`, `pinggy.io` e `localtunnel` tampouco funcionan dende
aquí. Se cambias de rede, isto daría unha URL temporal:

```bash
cloudflared tunnel --url http://localhost:8000
```

## Variables de contorno

| Variable | Por defecto | Descrición |
|---|---|---|
| `SECRET_KEY` | `dev-secret-change-me` | **Cambiaa en produción** (asinado JWT) |
| `DATABASE_URL` | `sqlite:///backend/app.db` | SQLite ou outro motor compatible |
| `MEDIA_DIR` | `backend/media` | Avatares |
| `PORT` | `8000` | Porto de uvicorn |
| `CORS_ORIGINS` | `http://localhost:5173` | Só necesario se o frontend vai noutro dominio |

## Checklist antes de compartir

- [ ] `SECRET_KEY` aleatoria e secreta.
- [ ] Datos demo resementados (`--reset` ou primeiro arranque).
- [ ] Probar login `lucia` / `demo1234`.
- [ ] Se van usuarios reais: cambiar contrasinais demo e revisar a política de acceso.
