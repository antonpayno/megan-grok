"""Tests da lóxica de conversa, sen chamadas reais á API."""

from __future__ import annotations

from types import SimpleNamespace

from megan_grok.chat import ChatSession
from megan_grok.config import Settings


class FakeCompletions:
    def __init__(self, reply: str = "ola mundo") -> None:
        self.reply = reply
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs.get("stream"):
            return iter(
                SimpleNamespace(
                    choices=[SimpleNamespace(delta=SimpleNamespace(content=piece))]
                )
                for piece in self.reply
            )
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=self.reply))]
        )


class FakeClient:
    def __init__(self, reply: str = "ola mundo") -> None:
        self.chat = SimpleNamespace(completions=FakeCompletions(reply))


def make_session(reply: str = "ola mundo", **overrides) -> ChatSession:
    settings = Settings(api_key="test", **overrides)
    return ChatSession(client=FakeClient(reply), settings=settings)


def test_streaming_devolve_texto_e_chama_on_chunk():
    session = make_session()
    pieces: list[str] = []

    reply = session.ask("Ola", stream=True, on_chunk=pieces.append)

    assert reply == "ola mundo"
    assert "".join(pieces) == "ola mundo"


def test_historial_inclue_system_e_turnos():
    session = make_session()
    session.ask("Ola", stream=False)

    payload = session.client.chat.completions.calls[0]["messages"]

    assert payload[0]["role"] == "system"
    assert payload[1] == {"role": "user", "content": "Ola"}
    assert session.messages == [
        {"role": "user", "content": "Ola"},
        {"role": "assistant", "content": "ola mundo"},
    ]


def test_segunda_peticion_inclue_o_turno_anterior():
    session = make_session()
    session.ask("Ola", stream=False)
    session.ask("Como estás?", stream=False)

    payload = session.client.chat.completions.calls[1]["messages"]

    assert [message["role"] for message in payload] == [
        "system",
        "user",
        "assistant",
        "user",
    ]
    assert payload[3] == {"role": "user", "content": "Como estás?"}


def test_max_history_recolle_os_turnos_mais_vellos():
    session = make_session(max_history=2)

    session.ask("un", stream=False)
    session.ask("dous", stream=False)

    assert session.messages == [
        {"role": "user", "content": "dous"},
        {"role": "assistant", "content": "ola mundo"},
    ]


def test_reset_baleira_o_historial():
    session = make_session()
    session.ask("Ola", stream=False)

    session.reset()

    assert session.messages == []
