from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import pdfplumber


DOWNLOADS = Path("/Users/sunny/Downloads")
LISTENING_PDF = next(DOWNLOADS.glob("*LISTENING TEST 1 (SCRIPT AND KEY).pdf"))
READING_PDF = next(DOWNLOADS.glob("*READING TEST 1- KEY.pdf"))
OCR_PATH = Path("tmp/pdfs/reading-ocr.txt")
SUPABASE_MEDIA_BASE_URL = (
    "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/"
    "toeic-media/T01-media"
)


LISTENING_KEYS = {
    1: "B", 2: "D", 3: "C", 4: "A", 5: "A", 6: "C",
    7: "B", 8: "C", 9: "B", 10: "A", 11: "B", 12: "B", 13: "C",
    14: "C", 15: "A", 16: "B", 17: "B", 18: "A", 19: "B",
    20: "C", 21: "A", 22: "C", 23: "A", 24: "A", 25: "A",
    26: "B", 27: "B", 28: "A", 29: "C", 30: "C", 31: "C",
    32: "B", 33: "D", 34: "B", 35: "C", 36: "A", 37: "D",
    38: "A", 39: "D", 40: "A", 41: "C", 42: "D", 43: "B",
    44: "C", 45: "C", 46: "A", 47: "A", 48: "D", 49: "C",
    50: "C", 51: "B", 52: "A", 53: "C", 54: "A", 55: "B",
    56: "B", 57: "A", 58: "C", 59: "A", 60: "C", 61: "B",
    62: "C", 63: "C", 64: "D", 65: "D", 66: "A", 67: "C",
    68: "B", 69: "A", 70: "C", 71: "B", 72: "C", 73: "A",
    74: "B", 75: "D", 76: "A", 77: "B", 78: "D", 79: "A",
    80: "D", 81: "A", 82: "B", 83: "D", 84: "A", 85: "D",
    86: "A", 87: "B", 88: "C", 89: "D", 90: "B", 91: "C",
    92: "B", 93: "A", 94: "D", 95: "A", 96: "C", 97: "D",
    98: "D", 99: "C", 100: "A",
}


READING_QUESTION_PAGES = {
    **{number: page for page, numbers in {
        1: [101, 102, 103], 2: [104, 105], 3: [106, 107],
        4: [108, 109, 110], 5: [111, 112], 6: [113, 114],
        7: [115, 116, 117], 8: [118, 119], 9: [120, 121, 122],
        10: [123, 124], 11: [125, 126], 12: [127, 128], 13: [129, 130],
        16: [131, 132], 17: [133, 134], 19: [135, 136], 20: [137, 138],
        22: [139, 140, 141], 23: [142], 24: [143], 25: [144, 145, 146],
        27: [147], 28: [148], 29: [149, 150], 31: [151, 152],
        33: [153, 154], 35: [155, 156, 157], 37: [158, 159, 160],
        39: [161, 162, 163], 41: [164, 165, 166], 42: [167],
        43: [168, 169, 170], 44: [171], 46: [172, 173], 47: [174, 175],
        51: [176], 52: [177, 178, 179, 180], 55: [181],
        56: [182, 183, 184, 185], 59: [186], 60: [187, 188, 189, 190],
        64: [191, 192, 193], 65: [194, 195], 69: [196, 197, 198, 199],
        70: [200],
    }.items() for number in numbers},
}


def compact(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("-------", "_____")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_pdf_text(text: str) -> str:
    text = re.sub(r"===== PAGE \d+ =====", " ", text)
    text = re.sub(r"ETS\s+20\d{2}\s+(?:LISTENING|READING)\s+TEST", " ", text, flags=re.I)
    text = re.sub(r"SCRIPT AND(?: KEY LC TEST 1)?", " ", text, flags=re.I)
    text = re.sub(r"TEST 1- KEY AND(?: EXPLANATION)?", " ", text, flags=re.I)
    text = re.sub(r"\b(?:STT|Transcript|Nội dung đề|Đáp án và giải thích)\b", " ", text, flags=re.I)
    return text


def parse_answer_choices(text: str, labels: tuple[str, ...]) -> tuple[str, list[dict[str, str]]]:
    text = clean_pdf_text(text)
    # A few answer labels in the PDF lose their opening parenthesis during
    # extraction (for example, "C) [3]"). Restore only labels at line starts.
    text = re.sub(r"(?m)^(\s*)([A-D])\)\s*", r"\1(\2) ", text)
    text = re.sub(r"(?<!\()\b([A-D])\)\s*", r"(\1) ", text)
    text = compact(text)
    pattern = re.compile(r"\(([A-D])\)\s*")
    matches = [match for match in pattern.finditer(text) if match.group(1) in labels]
    if not matches:
        return text, []

    question = compact(text[: matches[0].start()])
    answers: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, match in enumerate(matches):
        label = match.group(1)
        if label in seen:
            continue
        next_start = len(text)
        for later in matches[index + 1 :]:
            if later.group(1) not in seen and later.group(1) != label:
                next_start = later.start()
                break
        content = compact(text[match.end() : next_start])
        answers.append({"label": label, "content": content})
        seen.add(label)
        if len(seen) == len(labels):
            break
    return question, answers


def listening_part_source(part_number: int) -> str:
    source = Path("tmp/pdfs/listening-english.txt").read_text(encoding="utf-8")
    start_match = re.search(rf"(?m)^\s*PART\s+{part_number}\s*$", source)
    if not start_match:
        raise ValueError(f"Không tìm thấy Part {part_number} trong Listening PDF")
    next_match = re.search(
        rf"(?m)^\s*PART\s+{part_number + 1}\s*$", source[start_match.end() :]
    )
    end = (
        start_match.end() + next_match.start()
        if next_match
        else len(source)
    )
    return source[start_match.end() : end]


def make_listening_independent_questions() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    source = listening_part_source(1) + "\n" + listening_part_source(2)
    source = clean_pdf_text(source)
    starts = []
    for match in re.finditer(r"(?m)^\s*(\d{1,3})\s+(?![-.])(.*)$", source):
        number = int(match.group(1))
        if 1 <= number <= 31:
            starts.append((number, match.start(), match.end(1)))

    records: dict[int, str] = {}
    for index, (number, start, number_end) in enumerate(starts):
        end = starts[index + 1][1] if index + 1 < len(starts) else len(source)
        records[number] = source[number_end:end]

    part1: list[dict[str, Any]] = []
    part2: list[dict[str, Any]] = []
    for number in range(1, 32):
        labels = ("A", "B", "C", "D") if number <= 6 else ("A", "B", "C")
        question_text, answers = parse_answer_choices(records[number], labels)
        transcript_parts = []
        if question_text:
            transcript_parts.append(question_text)
        transcript_parts.extend(f"({answer['label']}) {answer['content']}" for answer in answers)
        if number <= 6:
            part1.append({
                "questionNumber": number,
                "imageUrl": None,
                "audioUrl": None,
                "question": None,
                "answers": answers,
                "correctAnswer": LISTENING_KEYS[number],
                "questionTranslation": None,
                "answerTranslation": None,
                "detailedExplanation": None,
                "transcript": compact(" ".join(transcript_parts)),
            })
        else:
            part2.append({
                "questionNumber": number,
                "audioUrl": None,
                "question": question_text,
                "answers": answers,
                "correctAnswer": LISTENING_KEYS[number],
                "questionTranslation": None,
                "answerTranslation": None,
                "detailedExplanation": None,
                "transcript": compact(" ".join(transcript_parts)),
            })
    return part1, part2


def listening_group_ranges(start: int, end: int) -> list[tuple[int, int]]:
    return [(number, number + 2) for number in range(start, end + 1, 3)]


def make_listening_groups(start: int, end: int) -> list[dict[str, Any]]:
    part_number = 3 if start == 32 else 4
    source = clean_pdf_text(listening_part_source(part_number))
    # The page's narrow range column wraps 98-100 as "98-10" / "0".
    source = re.sub(
        r"(?m)^(\s*)98-10(\s+.*)\n\s*0\s+",
        r"\1 98-100\2 ",
        source,
    )
    ranges = listening_group_ranges(start, end)
    group_start_pattern = re.compile(
        r"(?m)^\s*(" + "|".join(str(group_start) for group_start, _ in ranges) + r")\s*-\s*(.*)$"
    )
    occurrences = list(group_start_pattern.finditer(source))
    fragments: defaultdict[int, list[str]] = defaultdict(list)
    range_ends = dict(ranges)

    for index, match in enumerate(occurrences):
        group_start = int(match.group(1))
        fragment_end = occurrences[index + 1].start() if index + 1 < len(occurrences) else len(source)
        fragment = match.group(2) + source[match.end() : fragment_end]
        fragment = re.sub(
            rf"^\s*{range_ends[group_start]}\s+", "", fragment, flags=re.M
        )
        fragments[group_start].append(fragment)

    groups: list[dict[str, Any]] = []
    for group_index, (group_start, group_end) in enumerate(ranges, start=1):
        combined = compact(" ".join(fragments[group_start]))
        first_question = re.search(rf"\b{group_start}\.\s*", combined)
        transcript = compact(combined[: first_question.start()]) if first_question else combined
        questions: list[dict[str, Any]] = []

        for number in range(group_start, group_end + 1):
            question_match = re.search(rf"\b{number}\.\s*", combined)
            if not question_match:
                questions.append({
                    "questionNumber": number,
                    "question": None,
                    "answers": [],
                    "correctAnswer": LISTENING_KEYS[number],
                    "questionTranslation": None,
                    "answerTranslation": None,
                    "detailedExplanation": None,
                })
                continue
            next_match = None
            if number < group_end:
                next_match = re.search(rf"\b{number + 1}\.\s*", combined[question_match.end() :])
            question_end = (
                question_match.end() + next_match.start()
                if next_match
                else len(combined)
            )
            raw_question = combined[question_match.end() : question_end]
            question_text, answers = parse_answer_choices(raw_question, ("A", "B", "C", "D"))
            questions.append({
                "questionNumber": number,
                "question": question_text or None,
                "answers": answers,
                "correctAnswer": LISTENING_KEYS[number],
                "questionTranslation": None,
                "answerTranslation": None,
                "detailedExplanation": None,
            })

        groups.append({
            "groupNumber": group_index,
            "questionRange": f"{group_start}-{group_end}",
            "audioUrl": None,
            "imageUrl": None,
            "transcript": transcript or None,
            "questions": questions,
        })
    return groups


def find_reading_anchors(document: pdfplumber.PDF) -> dict[int, tuple[int, float]]:
    anchors: dict[int, tuple[int, float]] = {}
    for number, page_number in READING_QUESTION_PAGES.items():
        page = document.pages[page_number - 1]
        candidates = []
        for word in page.extract_words(extra_attrs=["size"]):
            digits = re.sub(r"\D", "", word["text"])
            if digits == str(number) and word["x0"] < 105 and 10 <= word["size"] <= 14:
                candidates.append(word)
        if not candidates:
            raise ValueError(f"Không tìm thấy anchor câu {number} trên trang {page_number}")
        # A passage can contain markers such as "(159)" that are not the
        # question row. Prefer the unparenthesized number printed in the table.
        table_candidates = [
            item for item in candidates if not item["text"].lstrip().startswith("(")
        ]
        anchor = min(table_candidates or candidates, key=lambda item: item["top"])
        anchors[number] = (page_number, float(anchor["top"]))
    return anchors


def crop_text(page: pdfplumber.page.Page, bbox: tuple[float, float, float, float]) -> str:
    return page.crop(bbox).extract_text(layout=True) or ""


def clean_row_text(text: str, question_number: int | None = None) -> str:
    text = clean_pdf_text(text)
    text = re.sub(r"Hien Nhung TOEIC|Teach By Heart", " ", text, flags=re.I)
    text = compact(text)
    if question_number is not None:
        text = re.sub(
            rf"^(?:{question_number}[.:]?\s*)+", "", text
        ).lstrip(". ")
    return text


def extract_correct_answer(explanation: str) -> str | None:
    patterns = [
        r"Chọn\s*\(?([ABCD])\)?",
        r"^\s*([ABCD])(?:\s|$)",
        r"Đáp án\s*\(?([ABCD])\)?",
    ]
    for pattern in patterns:
        match = re.search(pattern, explanation, flags=re.I)
        if match:
            return match.group(1).upper()
    return None


def find_column_split(page: pdfplumber.page.Page, top: float | None = None) -> float:
    """Return the x-coordinate of the English/Vietnamese table divider."""
    vertical_lines = [
        line
        for line in page.lines
        if abs(line["x1"] - line["x0"]) < 1
        and 250 < line["x0"] < 380
        and (top is None or line["top"] - 4 <= top <= line["bottom"] + 4)
    ]
    if not vertical_lines:
        vertical_lines = [
            line
            for line in page.lines
            if abs(line["x1"] - line["x0"]) < 1 and 250 < line["x0"] < 380
        ]
    if not vertical_lines:
        return 306.0
    divider = max(vertical_lines, key=lambda line: line["bottom"] - line["top"])
    return float(divider["x0"])


def find_table_bottom(page: pdfplumber.page.Page, top: float, split: float) -> float:
    divider_lines = [
        line
        for line in page.lines
        if abs(line["x1"] - line["x0"]) < 1
        and abs(line["x0"] - split) < 2
        and line["top"] - 4 <= top <= line["bottom"] + 4
    ]
    if not divider_lines:
        return page.height - 34
    return min(
        page.height - 34,
        max(line["bottom"] for line in divider_lines) + 1,
    )


def extract_bold_answer(
    page: pdfplumber.page.Page,
    bbox: tuple[float, float, float, float],
) -> str | None:
    """Correct choices in the source PDF are printed in bold."""
    for word in page.crop(bbox).extract_words(extra_attrs=["fontname"]):
        label_match = re.fullmatch(r"\(?([A-D])\)", word["text"])
        if label_match and "bold" in word.get("fontname", "").lower():
            return label_match.group(1)
    return None


def make_reading_questions() -> dict[int, dict[str, Any]]:
    results: dict[int, dict[str, Any]] = {}
    with pdfplumber.open(READING_PDF) as document:
        anchors = find_reading_anchors(document)
        anchors_by_page: defaultdict[int, list[tuple[int, float]]] = defaultdict(list)
        for number, (page_number, top) in anchors.items():
            anchors_by_page[page_number].append((number, top))
        for page_anchors in anchors_by_page.values():
            page_anchors.sort(key=lambda item: item[1])

        for number in range(101, 201):
            page_number, top = anchors[number]
            page = document.pages[page_number - 1]
            same_page = anchors_by_page[page_number]
            current_index = [item[0] for item in same_page].index(number)
            bottom = (
                same_page[current_index + 1][1] - 1
                if current_index + 1 < len(same_page)
                else None
            )
            split = find_column_split(page, top)
            if bottom is None:
                bottom = find_table_bottom(page, top, split)
            base_bbox = (30, max(50, top - 2), split, bottom)
            left = crop_text(page, base_bbox)
            right = crop_text(page, (split, max(50, top - 2), 585, bottom))
            bold_answer = extract_bold_answer(page, base_bbox)

            question_text, answers = parse_answer_choices(
                clean_row_text(left, number), ("A", "B", "C", "D")
            )

            if len(answers) < 4 and number < 200:
                next_page_number, next_top = anchors[number + 1]
                if next_page_number == page_number + 1:
                    next_page = document.pages[next_page_number - 1]
                    next_split = find_column_split(next_page)
                    continuation_bbox = (30, 50, next_split, next_top - 1)
                    left_continuation = crop_text(next_page, continuation_bbox)
                    right_continuation = crop_text(
                        next_page, (next_split, 50, 585, next_top - 1)
                    )
                    left += "\n" + left_continuation
                    right += "\n" + right_continuation
                    bold_answer = bold_answer or extract_bold_answer(
                        next_page, continuation_bbox
                    )
                    question_text, answers = parse_answer_choices(
                        clean_row_text(left, number), ("A", "B", "C", "D")
                    )

            # Three rows continue at the top of a following passage page.
            continuation_pages = {146: 26, 157: 36, 185: 57}
            if len(answers) < 4 and number in continuation_pages:
                continuation_page_number = continuation_pages[number]
                continuation_page = document.pages[continuation_page_number - 1]
                continuation_split = find_column_split(continuation_page)
                divider_lines = [
                    line
                    for line in continuation_page.lines
                    if abs(line["x1"] - line["x0"]) < 1
                    and abs(line["x0"] - continuation_split) < 2
                ]
                continuation_bottom = max(
                    (line["bottom"] for line in divider_lines), default=160
                )
                continuation_bbox = (
                    30,
                    50,
                    continuation_split,
                    continuation_bottom + 1,
                )
                left += "\n" + crop_text(continuation_page, continuation_bbox)
                right += "\n" + crop_text(
                    continuation_page,
                    (continuation_split, 50, 585, continuation_bottom + 1),
                )
                bold_answer = bold_answer or extract_bold_answer(
                    continuation_page, continuation_bbox
                )
                question_text, answers = parse_answer_choices(
                    clean_row_text(left, number), ("A", "B", "C", "D")
                )

            explanation = clean_row_text(right)
            results[number] = {
                "questionNumber": number,
                "question": question_text or None,
                "answers": answers,
                "correctAnswer": extract_correct_answer(explanation) or bold_answer,
                "questionTranslation": None,
                "answerTranslation": None,
                "detailedExplanation": explanation or None,
            }
    return results


def read_ocr_pages() -> dict[int, list[dict[str, Any]]]:
    pages: defaultdict[int, list[dict[str, Any]]] = defaultdict(list)
    current_page: int | None = None
    page_pattern = re.compile(r"===== page-(\d+)\.jpg =====")
    line_pattern = re.compile(
        r"\[x=([0-9.]+) y=([0-9.]+) w=([0-9.]+) h=([0-9.]+)\]\s*(.*)"
    )
    for line in OCR_PATH.read_text(encoding="utf-8").splitlines():
        page_match = page_pattern.fullmatch(line)
        if page_match:
            current_page = int(page_match.group(1))
            continue
        line_match = line_pattern.fullmatch(line)
        if current_page is None or not line_match:
            continue
        pages[current_page].append({
            "x": float(line_match.group(1)),
            "y": float(line_match.group(2)),
            "w": float(line_match.group(3)),
            "h": float(line_match.group(4)),
            "text": line_match.group(5).strip(),
        })
    return pages


def ocr_region(
    pages: dict[int, list[dict[str, Any]]],
    page_number: int,
    min_y: float,
    max_y: float,
    *,
    columns: bool = False,
) -> str:
    lines = [line for line in pages[page_number] if min_y <= line["y"] <= max_y]
    if columns:
        heading = [line for line in lines if line["w"] > 0.35 or line["y"] > max_y - 0.07]
        heading_ids = {id(line) for line in heading}
        left = [line for line in lines if id(line) not in heading_ids and line["x"] < 0.49]
        right = [line for line in lines if id(line) not in heading_ids and line["x"] >= 0.49]
        heading.sort(key=lambda line: (-line["y"], line["x"]))
        left.sort(key=lambda line: (-line["y"], line["x"]))
        right.sort(key=lambda line: (-line["y"], line["x"]))
        lines = heading + left + right
    else:
        lines.sort(key=lambda line: (-line["y"], line["x"]))
    return compact(" ".join(line["text"] for line in lines))


def passage(number: int, title: str | None, content: str, passage_type: str) -> dict[str, Any]:
    return {
        "passageNumber": number,
        "title": title,
        "content": content or None,
        "imageUrl": None,
        "type": passage_type,
    }


PART7_CONTENT_OVERRIDES = {
    (2, 1): (
        "Carol Barger (10:45 A.M.) Hello, Ms. Seang. "
        "Leakhena Seang (10:55 A.M.) Good morning! "
        "Carol Barger (11:15 A.M.) We have fifteen participants enrolled in your "
        "mosaic workshop tomorrow. That is five more than last summer. Your workshops "
        "get more popular every year! Do you have enough materials on hand for that "
        "many participants? "
        "Leakhena Seang (11:23 A.M.) I have plenty to go around. We'll be creating "
        "mosaic designs using bits of sea glass I collected on my vacation last summer. "
        "They are pieces of brown, green, and blue bottles that have washed ashore. "
        "The sand smoothed all the sharp edges, so they're perfectly safe for everyone "
        "to use. Carol Barger (11:30 A.M.) Sounds great. See you at breakfast tomorrow."
    ),
    (5, 1): (
        "To: Randi Longfellow <rlongfellow@sapphiremail.com.au>. From: Deon Welman "
        "<deonwelman@skyviewscopes.com.au>. Date: 27 March. Subject: Makatasi model "
        "METX-33948. Dear Ms. Longfellow, Thank you for ordering the Makatasi ET-Triple "
        "Refracting Telescope, model METX-33948. Unfortunately, the item you requested "
        "is on back order. — [1] —. If you do not wish to wait, we have a similar "
        "telescope from a different manufacturer, Belter Telescopes. Like the Makatasi "
        "model you ordered, the Belter BTR-1483 has a 120 mm aperture and a retractable "
        "lens hood. — [2] —. In addition, all Belter telescopes include a padded carrying "
        "case. The Belter BTR-1483 costs $200 less than the Makatasi METX-33948. If you "
        "wish to revise your order, simply reply to this e-mail within 48 hours or go to "
        "our Web site to chat with a representative at http://www.skyviewscopes.com.au. "
        "We will then change your order, refund $200 to your credit card, and ship your "
        "new telescope overnight at no extra charge. — [3] —. Otherwise, we will notify "
        "you when the Makatasi model METX-33948 is back in stock and provide delivery "
        "information at that point. — [4] —. Best regards, Deon Welman, Sales "
        "Representative, Skyview Scopes."
    ),
    (7, 1): (
        "Vimalo Brands Enters a New Era. By Yvette Maurer. VANCOUVER (2 August)—"
        "Vimalo Brands, the large consumer goods company that markets popular "
        "nutritional-support and personal-care products, including Powerburst breakfast "
        "drinks and Honeysoft soaps and lotions, will soon offer something new for its "
        "customers: frozen foods. “Our new Nutridinna line is not just about convenience,” "
        "CEO Danitza Martens said during a press conference earlier today. “Frozen foods "
        "are not a new concept, but our method of flash-freezing fresh produce and meats "
        "ensures that our products retain their texture and flavour as well as their "
        "healthy vitamins and minerals. Now our customers can enjoy the convenience of "
        "frozen food without sacrificing quality.” Vimalo Brands has partnered with "
        "Vancouver-area farms to obtain produce and meat for the Nutridinna line. “By "
        "keeping our operations local, we avoid shipping delays and can flash-freeze "
        "freshly harvested vegetables at their peak of ripeness,” Martens said. “Our "
        "customers benefit further, since our products can be kept in the freezer for up "
        "to six months.” Nutridinna foods will be available in supermarkets beginning in "
        "November. Frozen fish and other seafood will be added early next year."
    ),
    (13, 1): (
        "Lawal Home Service: Serving Southern California for over 40 years. Lawal Home "
        "Service provides roofing and solar solutions for Southern California residents "
        "in Inglewood and the surrounding areas. In addition to roof replacement, we "
        "offer a wide array of services, from attic insulation and gutter restoration "
        "to fixing leaks and installing solar panels. Lawal Home Service prides itself "
        "on transparent communication and attention to detail. Our project supervisors "
        "are always on-site to answer client questions, provide updates, and ensure a "
        "safe and clean worksite. To request a free roofing diagnosis, visit "
        "www.lawalhomeservice.com or call our booking agent at 310-555-0108."
    ),
    (13, 2): (
        "Lawal Home Service Contact Form. Trust the experts at Lawal Home Service to "
        "diagnose your roofing needs promptly and professionally. Please take a few "
        "minutes to complete the form with as much detail as possible. Remember, all "
        "roofs installed by Lawal have a 25-year warranty. Name: Drew Gerson. Date: "
        "December 12. E-mail: dgerson95@onyxmail.com. Phone: 310-555-0192. Address: "
        "820 North Acacia Street, Inglewood, CA 90301. How may we help you? During last "
        "week's windstorm, several roof shingles were torn loose and need replacing. I "
        "am considering replacing the entire roof as it is over 30 years old, and water "
        "has begun to drip through the section over the patio. I would appreciate talking "
        "to someone who could tell me my options and provide an estimate."
    ),
    (14, 1): (
        "To: Omar Balaji <obalaji@darbourycompany.com>. From: Juanita Pereira "
        "<jpereira@bunbunbooks.com>. Date: May 10. Subject: Notebook inquiry. Dear Mr. "
        "Balaji, We are expanding our office supply section at Bun Bun Books and would "
        "like to offer a selection of blank notebooks with lined pages. We would like "
        "your help creating the following cover designs: Great Thoughts—central image: "
        "lightbulb, lightning bolt, and star icons; background color: blue. World "
        "Suitcase—central image: suitcase with country-name travel stickers; background "
        "color: black. Lavender Bouquet—central image: large bunch of lavender on tall, "
        "pale green stems; background color: yellow. Sail Away—central image: sun setting "
        "in the sky above a sailboat on a lake; background color: white. We need to have "
        "notebooks in stock in time for our annual sale starting August 1. After approving "
        "the sample covers, when would we need to place our order? Thank you, Juanita "
        "Pereira."
    ),
    (14, 3): (
        "Darboury Company Order Form. Customer: Bun Bun Books. Ship by: July 15. "
        "Shipping method: Standard. Requested delivery date: July 20. Items: N3-GT—"
        "standard-size spiral notebook, Great Thoughts cover design, quantity 200; "
        "N3-WS—standard-size spiral notebook, World Suitcase cover design, quantity 200; "
        "H3-LB—small hardbound journal notebook, Lavender Bouquet cover design, quantity "
        "150; H3-SA—small hardbound journal notebook, Sail Away cover design, quantity "
        "150; D1—large metal display rack holding standard-size spiral notebooks, "
        "quantity 1."
    ),
}


def clean_passage_content(content: str) -> str:
    replacements = {
        "Hien Nhung TOEIC": "",
        "Teach By Heart": "",
        "DEIC": "",
        "a good reason tc celebrate": "a good reason to celebrate",
        "but it 1 necessary": "but it is necessary",
        "Note that al parking": "Note that all parking",
        "after 1 return": "after I return",
        "vork needed": "work needed",
        "lining areas": "dining areas",
        "restaurant wil accommodate": "restaurant will accommodate",
        "live musıc": "live music",
        "a tree dessert": "a free dessert",
        "for your food The Home": "for your food truck. The Home",
        "our inventorv": "our inventory",
        "protessionally": "professionally",
        "dates of ts much-anticipated": "dates of its much-anticipated",
        "each I hursda n lune": "each Thursday in June",
        "each Thursdav in Julv": "each Thursday in July",
        "*E-mail* Sales Team To: Laura Correa From:": "To: Sales Team. From: Laura Correa.",
        "NEW HAVEN (June 1)-Marco's Italian will be Restaurant on Frontage Road reopening":
            "NEW HAVEN (June 1)—Marco's Italian Restaurant on Frontage Road will be reopening",
        "kitchen an dining areas": "kitchen and dining areas",
    }
    for old, new in replacements.items():
        content = content.replace(old, new)
    return compact(content)


def build_part6(reading_questions: dict[int, dict[str, Any]], ocr_pages: dict[int, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    configs = [
        (1, 131, 134, "Look to Riessler Landscaping for Your Garden Needs", "Advertisement", 15, 0.555, 0.815),
        (2, 135, 138, None, "Letter", 18, 0.325, 0.845),
        (3, 139, 142, "Plans for living room", "Email", 21, 0.225, 0.655),
        (4, 143, 146, "Your recent office visit", "Email", 24, 0.385, 0.855),
    ]
    passages = []
    for passage_number, start, end, title, passage_type, page, min_y, max_y in configs:
        content = ocr_region(ocr_pages, page, min_y, max_y)
        content = re.sub(r"^Question\s+\d+-\d+\s*", "", content, flags=re.I)
        passages.append({
            "passageNumber": passage_number,
            "title": title,
            "passageType": passage_type,
            "content": content,
            "imageUrl": None,
            "questions": [reading_questions[number] for number in range(start, end + 1)],
        })
    return passages


def build_part7(reading_questions: dict[int, dict[str, Any]], ocr_pages: dict[int, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    group_configs = [
        (1, "SINGLE", 147, 148, [(27, 0.58, 0.81, "Notice", None, False)]),
        (2, "SINGLE", 149, 150, [(28, 0.24, 0.60, "Online Chat", None, False)]),
        (3, "SINGLE", 151, 152, [(30, 0.38, 0.81, "Email", "Updates", False)]),
        (4, "SINGLE", 153, 154, [(32, 0.30, 0.82, "Article", "Refurbished Theater Gives Town a Boost", False)]),
        (5, "SINGLE", 155, 157, [(34, 0.39, 0.82, "Email", "Makatasi model METX-33948", False)]),
        (6, "SINGLE", 158, 160, [(36, 0.30, 0.79, "Email", "RE: Inquiry about job opening", False)]),
        (7, "SINGLE", 161, 163, [(38, 0.54, 0.82, "Article", "Vimalo Brands Enters a New Era", True)]),
        (8, "SINGLE", 164, 167, [(40, 0.36, 0.82, "Advertisement", "Karning Creative Designs", False)]),
        (9, "SINGLE", 168, 171, [(42, 0.13, 0.61, "Article", None, False)]),
        (10, "SINGLE", 172, 175, [(45, 0.30, 0.82, "Online Chat", None, False)]),
        (11, "DOUBLE", 176, 180, [
            (49, 0.18, 0.82, "Article", "Tips for designing a Web site for a food-truck business", False),
            (50, 0.50, 0.87, "Email", "Feedback", False),
        ]),
        (12, "DOUBLE", 181, 185, [
            (53, 0.20, 0.82, "Email", "Drilling notice", False),
            (54, 0.60, 0.84, "Press Release", None, False),
        ]),
        (13, "TRIPLE", 186, 190, [
            (57, 0.56, 0.71, "Advertisement", "Lawal Home Service", False),
            (57, 0.18, 0.50, "Form", "Lawal Home Service Contact Form", False),
            (58, 0.59, 0.84, "Review", "Neighborhood Reviews: Lawal Home Service", False),
        ]),
        (14, "TRIPLE", 191, 195, [
            (61, 0.43, 0.84, "Email", "Notebook inquiry", False),
            (61, 0.07, 0.39, "Email", "Re: Notebook inquiry", False),
            (62, 0.53, 0.84, "Order Form", "Darboury Company Order Form", False),
        ]),
        (15, "TRIPLE", 196, 200, [
            (66, 0.30, 0.84, "Email", "Employee of the month", False),
            (67, 0.58, 0.84, "Review", "Wilson Autos (Westchester)", False),
            (67, 0.33, 0.50, "Notice", "The employee of the month for September is Erica Boyd", False),
        ]),
    ]

    groups = []
    for group_number, passage_type, start, end, sources in group_configs:
        passages = []
        for passage_number, (page, min_y, max_y, source_type, title, columns) in enumerate(sources, start=1):
            content = ocr_region(ocr_pages, page, min_y, max_y, columns=columns)
            content = re.sub(r"^Questions?\s+\d+-\d+[^.]*\.\s*", "", content, flags=re.I)
            content = PART7_CONTENT_OVERRIDES.get(
                (group_number, passage_number), clean_passage_content(content)
            )
            passages.append(passage(passage_number, title, content, source_type))
        groups.append({
            "groupNumber": group_number,
            "questionRange": f"{start}-{end}",
            "passageType": passage_type,
            "passages": passages,
            "questions": [reading_questions[number] for number in range(start, end + 1)],
        })
    return groups


def attach_supabase_media(data: dict[str, Any]) -> None:
    part1 = data["parts"][0]
    for question in part1["questions"]:
        question_number = question["questionNumber"]
        file_stem = f"T01-{question_number:02d}"
        question["audioUrl"] = f"{SUPABASE_MEDIA_BASE_URL}/audio/{file_stem}.mp3"
        question["imageUrl"] = f"{SUPABASE_MEDIA_BASE_URL}/picture/{file_stem}.png"

    part2 = data["parts"][1]
    for question in part2["questions"]:
        question_number = question["questionNumber"]
        question["audioUrl"] = (
            f"{SUPABASE_MEDIA_BASE_URL}/audio/T01-{question_number:02d}.mp3"
        )

    for part in data["parts"][2:4]:
        for group in part["groups"]:
            group["audioUrl"] = (
                f"{SUPABASE_MEDIA_BASE_URL}/audio/T01-{group['questionRange']}.mp3"
            )

    part6_files = [
        "T01-P6-131-134.png",
        "T01-P6-135-138.png",
        "T01-P6-139-142.png",
        "T01-P6-143-146.png",
    ]
    for passage_item, filename in zip(data["parts"][5]["passages"], part6_files, strict=True):
        passage_item["imageUrl"] = f"{SUPABASE_MEDIA_BASE_URL}/picture/{filename}"

    part7_files = [
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
    for group, filenames in zip(data["parts"][6]["passageGroups"], part7_files, strict=True):
        group["imageUrls"] = [
            f"{SUPABASE_MEDIA_BASE_URL}/picture/{filename}"
            for filename in filenames
        ]


def validate(data: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    questions: list[dict[str, Any]] = []
    questions.extend(data["parts"][0]["questions"])
    questions.extend(data["parts"][1]["questions"])
    for part_index in (2, 3):
        for group in data["parts"][part_index]["groups"]:
            questions.extend(group["questions"])
    questions.extend(data["parts"][4]["questions"])
    for passage_item in data["parts"][5]["passages"]:
        questions.extend(passage_item["questions"])
    for group in data["parts"][6]["passageGroups"]:
        questions.extend(group["questions"])

    numbers = [question["questionNumber"] for question in questions]
    if numbers != list(range(1, 201)):
        issues.append(f"Dãy questionNumber không đủ 1-200: {numbers}")
    expected_part_sizes = {
        1: len(data["parts"][0]["questions"]),
        2: len(data["parts"][1]["questions"]),
        3: sum(len(group["questions"]) for group in data["parts"][2]["groups"]),
        4: sum(len(group["questions"]) for group in data["parts"][3]["groups"]),
        5: len(data["parts"][4]["questions"]),
        6: sum(len(item["questions"]) for item in data["parts"][5]["passages"]),
        7: sum(len(group["questions"]) for group in data["parts"][6]["passageGroups"]),
    }
    if expected_part_sizes != {1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54}:
        issues.append(f"Sai số lượng câu theo Part: {expected_part_sizes}")
    if len(data["parts"][2]["groups"]) != 13:
        issues.append("Part 3 không đủ 13 groups")
    if len(data["parts"][3]["groups"]) != 10:
        issues.append("Part 4 không đủ 10 groups")
    if len(data["parts"][5]["passages"]) != 4:
        issues.append("Part 6 không đủ 4 passages")
    if len(data["parts"][6]["passageGroups"]) != 15:
        issues.append("Part 7 không đủ 15 passageGroups")
    for question in questions:
        number = question["questionNumber"]
        expected = 3 if 7 <= number <= 31 else 4
        labels = [answer["label"] for answer in question["answers"]]
        if len(labels) != expected or len(set(labels)) != expected:
            issues.append(f"Câu {number}: expected {expected} answers, got {labels}")
        if question["correctAnswer"] not in {"A", "B", "C", "D"}:
            issues.append(f"Câu {number}: thiếu correctAnswer")
        if any(not answer["content"] for answer in question["answers"]):
            issues.append(f"Câu {number}: có đáp án rỗng")
        if (7 <= number <= 130 or 147 <= number <= 200) and not question["question"]:
            issues.append(f"Câu {number}: thiếu question")
    for passage_item in data["parts"][5]["passages"]:
        if not passage_item["content"]:
            issues.append(f"Part 6 passage {passage_item['passageNumber']}: thiếu content")
    for group in data["parts"][6]["passageGroups"]:
        expected_passages = {"SINGLE": 1, "DOUBLE": 2, "TRIPLE": 3}[group["passageType"]]
        if len(group["passages"]) != expected_passages:
            issues.append(
                f"Part 7 group {group['groupNumber']}: sai số passage theo passageType"
            )
        for passage_item in group["passages"]:
            if not passage_item["content"]:
                issues.append(
                    f"Part 7 group {group['groupNumber']} passage "
                    f"{passage_item['passageNumber']}: thiếu content"
                )
    return issues


def main() -> None:
    part1, part2 = make_listening_independent_questions()
    reading_questions = make_reading_questions()
    ocr_pages = read_ocr_pages()

    part5_questions = []
    for number in range(101, 131):
        question = dict(reading_questions[number])
        question["grammarTopic"] = None
        part5_questions.append(question)

    data = {
        "testId": "test-1",
        "title": "TOEIC Listening & Reading - Test 1",
        "description": None,
        "totalQuestions": 200,
        "parts": [
            {"partNumber": 1, "name": "Photographs", "questions": part1},
            {"partNumber": 2, "name": "Question-Response", "questions": part2},
            {"partNumber": 3, "name": "Conversations", "groups": make_listening_groups(32, 70)},
            {"partNumber": 4, "name": "Talks", "groups": make_listening_groups(71, 100)},
            {"partNumber": 5, "name": "Incomplete Sentences", "questions": part5_questions},
            {"partNumber": 6, "name": "Text Completion", "passages": build_part6(reading_questions, ocr_pages)},
            {"partNumber": 7, "name": "Reading Comprehension", "passageGroups": build_part7(reading_questions, ocr_pages)},
        ],
    }

    attach_supabase_media(data)

    issues = validate(data)
    Path("tmp/pdfs/toeic-test-1.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    Path("tmp/pdfs/validation.txt").write_text("\n".join(issues) + "\n", encoding="utf-8")
    if not issues:
        json_text = json.dumps(data, ensure_ascii=False, indent=2)
        Path("output/test-1-data.json").write_text(
            json_text + "\n", encoding="utf-8"
        )
        Path("backend/src/main/resources/data/test-1-data.json").write_text(
            json_text + "\n", encoding="utf-8"
        )
        markdown = (
            "# TOEIC Listening & Reading – Test 1\n\n"
            "Dữ liệu được trích từ hai PDF Listening và Reading do người dùng cung cấp.\n\n"
            "Các URL audio của Part 1-4 và URL ảnh của Part 1 trỏ đến bucket Supabase "
            "`toeic-media`. Các ảnh graphic của Part 3-4 chưa có trong bucket nên vẫn là "
            "`null`. Một số questionTranslation, answerTranslation, grammarTopic và "
            "detailedExplanation cũng được giữ là `null`. Với Part 6, vị trí cần điền "
            "đã nằm trong `content`, vì vậy trường `question` của từng câu được giữ là `null`.\n\n"
            "## JSON\n\n"
            "```json\n"
            f"{json_text}\n"
            "```\n"
        )
        Path("output/test-1-data.md").write_text(markdown, encoding="utf-8")
    print(f"Wrote draft with {len(issues)} validation issue(s)")


if __name__ == "__main__":
    main()
