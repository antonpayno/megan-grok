"""Xestión da conversa contra a API de xAI (compatible con OpenAI)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable

from .config import Settings


@dataclass
class ChatSession:
    """Mantén o historial e envía as peticións ao modelo."""

    client: object
    settings: Settings
    messages: list[dict[str, str]] = field(default_factory=list)

    def reset(self) -> None:
        """Baleira o historial (a configuración mantense)."""
        self.messages.clear()

    def _trim(self) -> None:
        if self.settings.max_history <= 0:
            return
        excess = len(self.messages) - self.settings.max_history
        if excess > 0:
            del self.messages[:excess]

    def _payload(self, prompt: str) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self.settings.system_prompt},
            *self.messages,
            {"role": "user", "content": prompt},
        ]

    def ask(
        self,
        prompt: str,
        *,
        stream: bool = True,
        on_chunk: Callable[[str], None] | None = None,
    ) -> str:
        """Envía unha mensaxe e devolve a resposta completa.

        Con `stream=True` vai chamando a `on_chunk` co texto segundo chega.
        """
        request = {
            "model": self.settings.model,
            "messages": self._payload(prompt),
            "temperature": self.settings.temperature,
        }
        completions = self.client.chat.completions

        if stream:
            chunks: Iterable[object] = completions.create(**request, stream=True)
            parts: list[str] = []
            for chunk in chunks:
                delta = _first_delta(chunk)
                if delta:
                    parts.append(delta)
                    if on_chunk is not None:
                        on_chunk(delta)
            reply = "".join(parts)
        else:
            response = completions.create(**request, stream=False)
            reply = response.choices[0].message.content or ""
            if on_chunk is not None:
                on_chunk(reply)

        self.messages.append({"role": "user", "content": prompt})
        self.messages.append({"role": "assistant", "content": reply})
        self._trim()
        return reply


def _first_delta(chunk: object) -> str:
    """Extrae o texto dun chunk de streaming sen romper con chunks baleiros."""
    choices = getattr(chunk, "choices", None)
    if not choices:
        return ""
    delta = getattr(choices[0], "delta", None)
    content = getattr(delta, "content", None) if delta is not None else None
    return content or ""
