"""Extract vector data (lines, arcs, rectangles, text) from architectural PDFs."""

import pymupdf
from dataclasses import dataclass, field


@dataclass
class RawLine:
    x0: float
    y0: float
    x1: float
    y1: float
    width: float
    color: tuple = (0, 0, 0)


@dataclass
class RawArc:
    center_x: float
    center_y: float
    radius: float
    points: list = field(default_factory=list)
    width: float = 1.0


@dataclass
class RawRect:
    x0: float
    y0: float
    x1: float
    y1: float
    width: float
    fill: tuple | None = None


@dataclass
class RawText:
    text: str
    x: float
    y: float
    font_size: float
    bbox: tuple = (0, 0, 0, 0)


class PdfExtractor:
    def __init__(self, pdf_path: str):
        self.doc = pymupdf.open(pdf_path)

    def extract_page(self, page_num: int = 0):
        """Extract all vector data and text from a PDF page."""
        page = self.doc[page_num]
        drawings = page.get_drawings()
        text_data = page.get_text("dict", sort=True)

        lines: list[RawLine] = []
        arcs: list[RawArc] = []
        rects: list[RawRect] = []

        for path in drawings:
            line_width = path.get("width", 1.0)
            color = path.get("color", (0, 0, 0))

            for item in path["items"]:
                kind = item[0]

                if kind == "l":  # Line segment
                    p1, p2 = item[1], item[2]
                    lines.append(
                        RawLine(
                            x0=p1.x,
                            y0=p1.y,
                            x1=p2.x,
                            y1=p2.y,
                            width=line_width,
                            color=color,
                        )
                    )

                elif kind == "re":  # Rectangle
                    rect = item[1]
                    rects.append(
                        RawRect(
                            x0=rect.x0,
                            y0=rect.y0,
                            x1=rect.x1,
                            y1=rect.y1,
                            width=line_width,
                            fill=path.get("fill"),
                        )
                    )

                elif kind == "c":  # Cubic bezier curve (potential door arc)
                    p1, p2, p3, p4 = item[1], item[2], item[3], item[4]
                    # Estimate arc center and radius from bezier control points
                    cx = (p1.x + p4.x) / 2
                    cy = (p1.y + p4.y) / 2
                    radius = (
                        ((p1.x - p4.x) ** 2 + (p1.y - p4.y) ** 2) ** 0.5
                    ) / 2
                    arcs.append(
                        RawArc(
                            center_x=cx,
                            center_y=cy,
                            radius=radius,
                            points=[(p1.x, p1.y), (p2.x, p2.y), (p3.x, p3.y), (p4.x, p4.y)],
                            width=line_width,
                        )
                    )

        # Extract text annotations with positions
        texts: list[RawText] = []
        for block in text_data.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    texts.append(
                        RawText(
                            text=span["text"],
                            x=span["origin"][0],
                            y=span["origin"][1],
                            font_size=span["size"],
                            bbox=tuple(span["bbox"]),
                        )
                    )

        return lines, arcs, rects, texts

    @property
    def page_count(self) -> int:
        return len(self.doc)

    def close(self):
        self.doc.close()
