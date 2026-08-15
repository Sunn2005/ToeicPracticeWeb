#!/usr/bin/env python3
"""Merge Reading translations and explanations into the TOEIC test JSON."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Iterator


EXPECTED_QUESTION_NUMBERS = set(range(101, 201))
KNOWN_BROKEN_QUOTE = (
    '\\n"Bạn có thể xem danh sách đầy đủ các thông số kỹ thuật trên trang web '
    'của chúng tôi." \\n(A)'
)
ESCAPED_QUOTE = (
    '\\n\\"Bạn có thể xem danh sách đầy đủ các thông số kỹ thuật trên trang web '
    'của chúng tôi.\\" \\n(A)'
)


def load_review_items(path: Path) -> list[dict[str, Any]]:
    raw = path.read_text(encoding="utf-8")
    try:
        items = json.loads(raw)
    except json.JSONDecodeError:
        if raw.count(KNOWN_BROKEN_QUOTE) != 1:
            raise
        items = json.loads(raw.replace(KNOWN_BROKEN_QUOTE, ESCAPED_QUOTE))

    if not isinstance(items, list):
        raise ValueError("File review phải là một JSON array")

    numbers = [item.get("questionNumber") for item in items]
    if len(numbers) != len(set(numbers)):
        raise ValueError("File review có questionNumber bị trùng")
    if set(numbers) != EXPECTED_QUESTION_NUMBERS:
        missing = sorted(EXPECTED_QUESTION_NUMBERS - set(numbers))
        extra = sorted(set(numbers) - EXPECTED_QUESTION_NUMBERS)
        raise ValueError(f"Sai phạm vi câu Reading; thiếu={missing}, thừa={extra}")
    return items


def iter_questions(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, dict):
        if isinstance(value.get("questionNumber"), int):
            yield value
        for child in value.values():
            yield from iter_questions(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_questions(child)


def normalize_translation(value: str) -> str:
    lines = [line.strip() for line in value.replace("\r\n", "\n").split("\n")]
    return "\n".join(lines).strip()


def format_explanation(value: str) -> str:
    text = re.sub(r"[ \t]+", " ", value.replace("\r\n", "\n")).strip()
    text = re.sub(r"\s+(?=\([A-D]\)\s)", "\n", text)
    text = re.sub(
        r"\s+(?=(?:Useful Structures?|Useful phrases):)",
        "\n\n",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"^Chọn\n(?=\([A-D]\))", "Chọn ", text)
    text = re.sub(r"^(Chọn \([A-D]\)[^.]*\.)\s+", r"\1\n\n", text)
    text = re.sub(r"^(Đáp án [A-D] đúng vì:)\s*", r"\1\n", text)
    text = re.sub(r"\s+(?=\(\d+\)[\"“])", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def merge(source: Path, target: Path) -> int:
    items = load_review_items(source)
    test_data = json.loads(target.read_text(encoding="utf-8"))
    all_questions = list(iter_questions(test_data))
    if len(all_questions) != 200:
        raise ValueError(f"File đề phải có 200 câu, hiện có {len(all_questions)}")

    for question in all_questions:
        previous_description = question.pop("description", None)
        if "translation" not in question:
            question["translation"] = previous_description

    questions = {
        question["questionNumber"]: question
        for question in all_questions
        if question["questionNumber"] in EXPECTED_QUESTION_NUMBERS
    }
    if set(questions) != EXPECTED_QUESTION_NUMBERS:
        missing = sorted(EXPECTED_QUESTION_NUMBERS - set(questions))
        raise ValueError(f"File đề thiếu câu Reading: {missing}")

    for item in items:
        question = questions[item["questionNumber"]]
        question["translation"] = normalize_translation(item["translation"])
        question["explanation"] = format_explanation(item["explanation"])

    target.write_text(
        json.dumps(test_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(items)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("targets", nargs="+", type=Path)
    args = parser.parse_args()

    for target in args.targets:
        count = merge(args.source, target)
        print(f"Đã nhập {count} câu vào {target}")


if __name__ == "__main__":
    main()
