from __future__ import annotations

from pathlib import Path


DEFAULT_FILE = Path(__file__).resolve().parent / "high_score.txt"


def load_high_score(path: Path | None = None) -> int:
    p = path or DEFAULT_FILE
    try:
        txt = p.read_text(encoding="utf-8").strip()
        return int(txt) if txt else 0
    except FileNotFoundError:
        return 0
    except Exception:
        return 0


def save_high_score(score: int, path: Path | None = None) -> None:
    p = path or DEFAULT_FILE
    p.write_text(str(int(score)), encoding="utf-8")


def update_high_score_if_needed(score: int, path: Path | None = None) -> int:
    current = load_high_score(path)
    if score > current:
        save_high_score(score, path)
        return score
    return current

