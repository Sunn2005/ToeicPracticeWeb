#!/usr/bin/env python3
"""Attach public Supabase graphics to the matching Part 3 and Part 4 groups."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PUBLIC_BASE_URL = (
    "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/"
    "toeic-media/T01-media/picture"
)

GROUP_IMAGES = {
    (3, "62-64"): "T01-P3-62-64.png",
    (3, "65-67"): "T01-P3-65-67.png",
    (3, "68-70"): "T01-P3-68-70.png",
    (4, "95-97"): "T01-P4-95-97.png",
    (4, "98-100"): "T01-P4-98-100.png",
}


def public_url(filename: str) -> str:
    return f"{PUBLIC_BASE_URL}/{filename}"


def apply_images(target: Path) -> None:
    data: dict[str, Any] = json.loads(target.read_text(encoding="utf-8"))
    updated: set[tuple[int, str]] = set()

    for part in data.get("parts", []):
        part_number = part.get("partNumber")
        for group in part.get("groups") or []:
            key = (part_number, group.get("questionRange"))
            filename = GROUP_IMAGES.get(key)
            if filename:
                group["imageUrl"] = public_url(filename)
                updated.add(key)

    missing = set(GROUP_IMAGES) - updated
    if missing:
        missing_ranges = ", ".join(
            f"Part {part} câu {question_range}"
            for part, question_range in sorted(missing)
        )
        raise ValueError(f"Không tìm thấy group cần gắn ảnh: {missing_ranges}")

    target.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("targets", nargs="+", type=Path)
    args = parser.parse_args()
    for target in args.targets:
        apply_images(target)
        print(f"Đã cập nhật ảnh Part 3–4: {target}")


if __name__ == "__main__":
    main()
