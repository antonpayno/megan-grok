import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'app.db'}")
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", str(BASE_DIR / "media")))
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", str(24 * 7)))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# Límites del patrón (compartidos con el frontend: src/api/types.ts)
MAX_PATTERN_SIDE = 128
MAX_PALETTE_COLORS = 64
