from pathlib import Path

import pdfplumber


DOWNLOADS = Path("/Users/sunny/Downloads")
LISTENING_PDF = next(DOWNLOADS.glob("*LISTENING TEST 1 (SCRIPT AND KEY).pdf"))
READING_PDF = next(DOWNLOADS.glob("*READING TEST 1- KEY.pdf"))


def extract(source: Path, destination: Path) -> None:
    chunks: list[str] = []

    with pdfplumber.open(source) as document:
        for page_number, page in enumerate(document.pages, start=1):
            text = page.extract_text(layout=True) or ""
            chunks.append(f"\n===== PAGE {page_number} =====\n{text}\n")

    destination.write_text("".join(chunks), encoding="utf-8")


def extract_crop(source: Path, destination: Path, bbox: tuple[float, float, float, float]) -> None:
    chunks: list[str] = []

    with pdfplumber.open(source) as document:
        for page_number, page in enumerate(document.pages, start=1):
            text = page.crop(bbox).extract_text(layout=True) or ""
            chunks.append(f"\n===== PAGE {page_number} =====\n{text}\n")

    destination.write_text("".join(chunks), encoding="utf-8")


extract(
    LISTENING_PDF,
    Path("tmp/pdfs/listening.txt"),
)
extract_crop(
    LISTENING_PDF,
    Path("tmp/pdfs/listening-english.txt"),
    (20, 60, 290, 800),
)
extract_crop(
    LISTENING_PDF,
    Path("tmp/pdfs/listening-keys.txt"),
    (285, 60, 335, 800),
)
extract_crop(
    READING_PDF,
    Path("tmp/pdfs/reading-left.txt"),
    (30, 50, 306, 760),
)
extract_crop(
    READING_PDF,
    Path("tmp/pdfs/reading-right.txt"),
    (306, 50, 585, 760),
)
extract(
    READING_PDF,
    Path("tmp/pdfs/reading.txt"),
)
