from pathlib import Path

from PIL import Image, ImageDraw


def make_sheets(source_dir: Path, output_prefix: Path, pages_per_sheet: int = 12) -> None:
    page_paths = sorted(source_dir.glob("page-*.png"))
    thumb_width = 300
    label_height = 28
    columns = 3
    rows = (pages_per_sheet + columns - 1) // columns

    for sheet_index in range(0, len(page_paths), pages_per_sheet):
        batch = page_paths[sheet_index : sheet_index + pages_per_sheet]
        first = Image.open(batch[0]).convert("RGB")
        thumb_height = round(first.height * thumb_width / first.width)
        canvas = Image.new(
            "RGB",
            (columns * thumb_width, rows * (thumb_height + label_height)),
            "white",
        )
        draw = ImageDraw.Draw(canvas)

        for offset, page_path in enumerate(batch):
            page = Image.open(page_path).convert("RGB")
            page.thumbnail((thumb_width, thumb_height))
            column = offset % columns
            row = offset // columns
            x = column * thumb_width
            y = row * (thumb_height + label_height)
            canvas.paste(page, (x, y + label_height))
            page_number = sheet_index + offset + 1
            draw.text((x + 8, y + 7), f"Page {page_number}", fill="black")

        output = output_prefix.with_name(
            f"{output_prefix.name}-{sheet_index // pages_per_sheet + 1}.jpg"
        )
        canvas.save(output, quality=88)


make_sheets(Path("tmp/pdfs/listening-pages"), Path("tmp/pdfs/listening-contact"))
make_sheets(Path("tmp/pdfs/reading-pages"), Path("tmp/pdfs/reading-contact"))
