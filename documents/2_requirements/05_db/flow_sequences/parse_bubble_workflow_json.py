#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bubble から保存した JSON（アプリ定義・ワークフロー断片など）を再帰走査し、
Create / Make changes / データ型名 等を含むノード付近のパスを列挙する。

正式スキーマは非公開のため補助用。結果は Editor 実物と突合すること。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

DEFAULT_NEEDLES_EN = (
    "Create a new",
    "Make changes to",
    "Delete a thing",
    "Schedule API",
    "Trigger",
    "workflow",
    "Workflow",
)

DEFAULT_NEEDLES_JA = (
    "予約情報",
    "自転車予約詳細",
    "オプション予約詳細",
    "乗車人情報",
    "Current User",
    "\"cart\"",  # User フィールド名付近
)


def iter_values(obj: Any, path: str = "$") -> Iterator[tuple[str, Any]]:
    yield path, obj
    if isinstance(obj, dict):
        for k, v in obj.items():
            kp = f"{path}.{k}" if path else k
            yield from iter_values(v, kp)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from iter_values(v, f"{path}[{i}]")


def main() -> None:
    ap = argparse.ArgumentParser(description="Search Bubble-ish JSON for workflow strings.")
    ap.add_argument("json_path", type=Path, help="Path to JSON file")
    ap.add_argument(
        "--hint",
        action="append",
        default=[],
        metavar="SUBSTR",
        help="Substring that must appear in branch JSON (repeatable), e.g. CartBtn",
    )
    ap.add_argument(
        "--max-print",
        type=int,
        default=200,
        help="Max characters to print per match",
    )
    args = ap.parse_args()

    text = args.json_path.read_text(encoding="utf-8")
    try:
        root = json.loads(text)
    except json.JSONDecodeError as e:
        print("JSON parse error:", e, file=sys.stderr)
        sys.exit(1)

    needles = list(DEFAULT_NEEDLES_EN) + list(DEFAULT_NEEDLES_JA)
    hint_lower = [h.lower() for h in args.hint]

    matches = 0
    for path, node in iter_values(root):
        if isinstance(node, (dict, list)):
            blob = json.dumps(node, ensure_ascii=False)
        elif isinstance(node, str):
            blob = node
        else:
            continue
        if not any(n in blob for n in needles):
            continue
        if hint_lower and not all(h in blob.lower() for h in hint_lower):
            continue
        snippet = blob[: args.max_print] + ("…" if len(blob) > args.max_print else "")
        print(path)
        print("  ", snippet.replace("\n", " "))
        print()
        matches += 1

    if matches == 0:
        print(
            "No matching branches. Try omitting --hint or using a shorter hint.",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
