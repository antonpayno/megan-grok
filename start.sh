#!/bin/sh
# Arranque de producción: siembra solo si la BD está vacía y lanza uvicorn.
set -e

python -m app.seed
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers
