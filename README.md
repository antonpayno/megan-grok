# megan-grok

Chat de terminal para **Grok** (xAI), só en Python. Conversa por consola co
historial de mensaxes, respostas en streaming e comandos básicos.

## Requisitos

- Python 3.10 ou superior
- [uv](https://docs.astral.sh/uv/) (recomendado) ou `pip`
- Unha chave da API de xAI: https://console.x.ai

## Instalación

```bash
uv sync
cp .env.example .env
```

Edita `.env` e enche `XAI_API_KEY`. O ficheiro `.env` está ignorado por git:
nunca se sobe ao repositorio.

## Uso

```bash
# modo interactivo
uv run megan-grok

# unha soa pregunta e saír
uv run megan-grok -p "Que é Grok?"

# escoller modelo ou prompt de sistema
uv run megan-grok -m grok-4 -s "Responde como un pirata"

# sen streaming
uv run megan-grok --no-stream
```

Dentro do modo interactivo:

| Comando  | Acción                          |
| -------- | ------------------------------- |
| `/help`  | amosar a axuda                   |
| `/clear` | borrar o historial               |
| `/exit`  | saír (`/quit` tamén funciona)    |

## Configuración

| Variable              | Por defecto             | Descrición                    |
| --------------------- | ----------------------- | ----------------------------- |
| `XAI_API_KEY`         | —                       | Chave da API (obrigatoria)    |
| `MEGAN_GROK_MODEL`    | `grok-4`                | Modelo de xAI                 |
| `MEGAN_GROK_BASE_URL` | `https://api.x.ai/v1`   | Endpoint compatible OpenAI    |

## Tests

```bash
uv run pytest
```

Os tests usan un cliente falso: non fan chamadas de rede nin precisan chave.
