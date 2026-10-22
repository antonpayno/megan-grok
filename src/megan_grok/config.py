"""Configuración da aplicación, lida de variables de contorno."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

DEFAULT_BASE_URL = "https://api.x.ai/v1"
DEFAULT_MODEL = "grok-4"
DEFAULT_SYSTEM_PROMPT = (
    "Es Megan, un asistente útil e directo. Respondes en galego agás que "
    "o usuario che pida outro idioma."
)


class ConfigError(RuntimeError):
    """Falta configuración obrigatoria (normalmente a chave da API)."""


@dataclass(frozen=True)
class Settings:
    api_key: str
    model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    temperature: float = 0.7
    max_history: int = 20


def load_settings(
    *,
    model: str | None = None,
    system_prompt: str | None = None,
    temperature: float | None = None,
    max_history: int | None = None,
) -> Settings:
    """Le `.env` e o contorno, aplicando os valores pasados por argumento."""
    load_dotenv()

    api_key = os.getenv("XAI_API_KEY", "").strip()
    if not api_key:
        raise ConfigError(
            "Falta XAI_API_KEY. Copia .env.example a .env e engade a túa "
            "chave de https://console.x.ai"
        )

    env_model = os.getenv("MEGAN_GROK_MODEL", "").strip()
    base_url = os.getenv("MEGAN_GROK_BASE_URL", "").strip() or DEFAULT_BASE_URL

    return Settings(
        api_key=api_key,
        model=model or env_model or DEFAULT_MODEL,
        base_url=base_url,
        system_prompt=system_prompt or DEFAULT_SYSTEM_PROMPT,
        temperature=0.7 if temperature is None else temperature,
        max_history=20 if max_history is None else max_history,
    )
