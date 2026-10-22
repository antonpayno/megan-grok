# Build del frontend + API FastAPI en un solo contenedor.
# La demo final se sirve desde el mismo proceso (FastAPI sirve frontend/dist).

FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# opencv-python-headless necesita libglib; scikit-learn, libgomp.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend backend
COPY --from=frontend /app/frontend/dist frontend/dist
COPY start.sh /app/start.sh

WORKDIR /app/backend
EXPOSE 8000
CMD ["sh", "/app/start.sh"]
