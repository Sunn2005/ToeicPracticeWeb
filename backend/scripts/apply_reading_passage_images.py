#!/usr/bin/env python3
"""Attach public Supabase images to Part 6 and Part 7 reading passages."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


PUBLIC_BASE_URL = (
    "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/"
    "toeic-media/T01-media/picture"
)

PART_6_FILES = [
    "T01-P6-131-134.png",
    "T01-P6-135-138.png",
    "T01-P6-139-142.png",
    "T01-P6-143-146.png",
]

PART_7_FILES = [
    ["T01-P7-147-148.png"],
    ["T01-P7-149-151.png"],
    ["T01-P7-152-153.png"],
    ["T01-P7-154-156.png"],
    ["T01-P7-157-158.png"],
    ["T01-P7-159-161.png"],
    ["T01-P7-162-163.png"],
    ["T01-P7-164-167.png"],
    ["T01-P7-168-171.png"],
    ["T01-P7-172-175.png"],
    ["T01-P7-176-180-1.png", "T01-P7-176-180-2.png"],
    ["T01-P7-181-185-1.png", "T01-P7-181-185-2.png"],
    ["T01-P7-186-190-1.png", "T01-P7-186-190-2.png"],
    [
        "T01-P7-191-195-1.png",
        "T01-P7-191-195-2.png",
        "T01-P7-191-195-3.png",
    ],
    [
        "T01-P7-196-200-1.png",
        "T01-P7-196-200-2.png",
        "T01-P7-196-200-3.png",
    ],
]


def public_url(filename: str) -> str:
    return f"{PUBLIC_BASE_URL}/{filename}"


def apply_images(target: Path) -> None:
    data = json.loads(target.read_text(encoding="utf-8"))
    parts = {part["partNumber"]: part for part in data.get("parts", [])}

    part_6_passages = parts[6].get("passages", [])
    part_7_groups = parts[7].get("passageGroups", [])
    if len(part_6_passages) != len(PART_6_FILES):
        raise ValueError(f"Part 6 phải có 4 passage, hiện có {len(part_6_passages)}")
    if len(part_7_groups) != len(PART_7_FILES):
        raise ValueError(f"Part 7 phải có 15 group, hiện có {len(part_7_groups)}")

    for passage, filename in zip(part_6_passages, PART_6_FILES, strict=True):
        passage["imageUrl"] = public_url(filename)

    for group, filenames in zip(part_7_groups, PART_7_FILES, strict=True):
        group["imageUrls"] = [public_url(filename) for filename in filenames]

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
        print(f"Đã cập nhật ảnh Part 6–7: {target}")


if __name__ == "__main__":
    main()
