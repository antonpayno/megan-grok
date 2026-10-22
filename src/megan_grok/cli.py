"""Interface de liña de ordes para conversar con Grok."""

from __future__ import annotations

import argparse
import sys

from openai import OpenAI

from . import __version__
from .chat import ChatSession
from .config import ConfigError, DEFAULT_MODEL, Settings, load_settings

BANNER = "Megan Grok — chat de terminal (modelo: {model})"
HINT = "Escribe a túa mensaxe. /help para axuda, /exit para saír."
COMMANDS = {
    "/exit": "saír",
    "/quit": "saír",
    "/clear": "borrar o historial da conversa",
    "/help": "amosar esta axuda",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="megan-grok",
        description="Chat de terminal contra a API de Grok (xAI).",
    )
    parser.add_argument("-p", "--prompt", help="enviar unha soa mensaxe e saír")
    parser.add_argument("-m", "--model", help=f"modelo a usar (por defecto {DEFAULT_MODEL})")
    parser.add_argument("-s", "--system", help="prompt de sistema personalizado")
    parser.add_argument(
        "--no-stream",
        action="store_true",
        help="agardar a resposta completa en vez de amosala por partes",
    )
    parser.add_argument(
        "--max-history",
        type=int,
        default=None,
        help="mensaxes de historial a conservar (0 = sen límite)",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        settings = load_settings(
            model=args.model,
            system_prompt=args.system,
            max_history=args.max_history,
        )
    except ConfigError as exc:
        print(f"Erro de configuración: {exc}", file=sys.stderr)
        return 2

    client = OpenAI(api_key=settings.api_key, base_url=settings.base_url)
    session = ChatSession(client=client, settings=settings)

    if args.prompt:
        return _ask_once(session, args.prompt, stream=not args.no_stream)
    return _repl(session, stream=not args.no_stream)


def _ask_once(session: ChatSession, prompt: str, *, stream: bool) -> int:
    try:
        reply = session.ask(prompt, stream=stream, on_chunk=_print_chunk)
    except KeyboardInterrupt:
        print()
        return 130
    except Exception as exc:  # noqa: BLE001 - amosamos o erro ao usuario
        return _report_error(exc)
    if not stream:
        print(reply)
    else:
        print()
    return 0


def _repl(session: ChatSession, *, stream: bool) -> int:
    settings: Settings = session.settings
    print(BANNER.format(model=settings.model))
    print(HINT)

    while True:
        try:
            prompt = input("\nti> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nata logo!")
            return 0

        if not prompt:
            continue

        command = prompt.lower()
        if command in {"/exit", "/quit"}:
            print("ata logo!")
            return 0
        if command == "/clear":
            session.reset()
            print("(historial borrado)")
            continue
        if command == "/help":
            for name, description in COMMANDS.items():
                print(f"  {name:<8} {description}")
            print("  calquera outra liña envíaselle ao modelo")
            continue

        print("megan> ", end="", flush=True)
        try:
            if stream:
                session.ask(prompt, stream=True, on_chunk=_print_chunk)
                print()
            else:
                print(session.ask(prompt, stream=False))
        except KeyboardInterrupt:
            print("\n(resposta interrompida)")
        except Exception as exc:  # noqa: BLE001 - amosamos o erro ao usuario
            _report_error(exc)


def _print_chunk(text: str) -> None:
    print(text, end="", flush=True)


def _report_error(exc: Exception) -> int:
    name = type(exc).__name__
    print(f"\nErro ({name}): {exc}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
