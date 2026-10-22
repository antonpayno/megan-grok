# Pixel Pattern 🧩🧵

Crea patrones de **HAMA** y **punto de cruz** dibujando o desde una foto, compártelos en un
feed tipo Instagram y haz los de otros.

> Este README es el plan de equipo para el hackathon. Persona 1 lo reescribirá al final
> como README del proyecto. Contexto técnico completo para los agentes: **AGENTS.md**.

## Datos de demo

Desde `backend/`:

```bash
python -m app.seed          # solo si la base de datos está vacía
python -m app.seed --reset  # borra app.db y vuelve a sembrar todo
```

Crea 8 usuarios demo con contraseña **`demo1234`** (`lucia`, `mario`, `noa`, `hugo`,
`ivan`, `alma`, `xiana`, `breogan`), 30 patrones, follows, likes y comentarios.

## Reparto

| # | Rol | Rama | Prompt |
|---|---|---|---|
| P1 | Backend core (auth, usuarios, follows, seed) + **integrador** | `feat/backend-core` | `prompts/P1-backend-core.md` |
| P2 | Motor imagen → patrón (+ export PNG/PDF) | `feat/engine` | `prompts/P2-engine.md` |
| P3 | Backend social (posts, feed, likes, comentarios, búsqueda) | `feat/backend-social` | `prompts/P3-backend-social.md` |
| P4 | Frontend: editor de patrones + modo "hacer" | `feat/editor` | `prompts/P4-editor.md` |
| P5 | Frontend: feed, perfiles, búsqueda, auth, layout | `feat/social-ui` | `prompts/P5-social-ui.md` |

Sugerencia: P2 a quien más le guste el procesado de imagen / visión; P4 a quien más
cómodo esté con canvas y estado en React.

## Paso 0 — una sola persona (P1), 5 minutos

```bash
# en la raíz del repo de GitHub, con este kit copiado dentro
git add . && git commit -m "chore: scaffold y contrato de la API" && git push origin main
```

## Paso 1 — cada persona

```bash
git pull origin main
git checkout -b feat/<tu-rama>
opencode            # en la raíz del repo
```

En opencode: pega **tu prompt** de `prompts/`. Recomendado: primero en modo *plan* (Tab) para
que proponga el plan, revísalo, y luego cambia a modo *build*. Pídele que avance por fases
y haga commit al acabar cada una.

## Puntos de integración (P1 los dirige)

Cada checkpoint: todos hacen push de su rama → P1 mergea a `main` en este orden →
todos hacen `git merge origin/main` en su rama para tener lo de los demás.

1. `feat/backend-core` 2. `feat/engine` 3. `feat/backend-social` 4. `feat/editor` 5. `feat/social-ui`

Como cada uno solo toca sus archivos, los merges deberían salir sin conflictos.
Si hay conflicto, casi siempre será en `requirements.txt` o `package.json`: quedaros con ambas líneas.

| Checkpoint | Objetivo |
|---|---|
| **C1** (~2-3 h) | Fase 1 de cada prompt: login real, convertir imagen, publicar y ver feed sin mocks |
| **C2** (~mitad del tiempo) | Fase 2: app completa de punta a punta + seed con datos de demo |
| **C3** (2 h antes del final) | **Congelar features.** Solo bugs, pulido visual y ensayo de la demo |

## Demo (guion de 2 minutos)

1. Feed con patrones de demo → abrir uno → "Hacer este patrón" (marcar celdas, lista de materiales).
2. Crear → subir una foto → bajar colores / subir "simplificar" → se convierte en dibujo HAMA.
3. Retocar un par de cuentas en el editor → publicar → aparece en el feed.
4. Buscar `#gato` y un perfil → seguir → pestaña Siguiendo.
