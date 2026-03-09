"""Parse floor plan PDF to extract room layouts and detect drawing scale."""

import re
from app.services.pdf_extractor import RawLine, RawText
from app.utils.geometry import Line, line_length


class FloorPlanParser:
    def detect_scale(self, texts: list[RawText], lines: list[RawLine]) -> float:
        """
        Detect drawing scale from annotations.
        Japanese architectural PDFs typically have "S=1/100" or "1:50" scale markers,
        and dimension text like "3,640" (in mm).
        Returns the scale denominator (e.g., 100 for 1:100).
        """
        # Method 1: Explicit scale annotation
        for t in texts:
            match = re.search(r"[Ss=:]\s*1\s*[/:](\d+)", t.text)
            if match:
                return float(match.group(1))

        # Method 2: Infer from dimension annotations vs line lengths
        scale = self._infer_scale_from_dimensions(texts, lines)
        if scale:
            return scale

        # Default: 1:100 (most common for Japanese residential)
        return 100.0

    def _infer_scale_from_dimensions(
        self, texts: list[RawText], lines: list[RawLine]
    ) -> float | None:
        """Cross-reference dimension text with nearby line lengths."""
        for t in texts:
            # Match Japanese dimension formats: "3,640" or "1820" or "910"
            cleaned = t.text.replace(",", "").replace(".", "").strip()
            dim_match = re.match(r"^(\d{3,5})$", cleaned)
            if not dim_match:
                continue

            real_mm = float(dim_match.group(1))
            if real_mm < 100 or real_mm > 30000:
                continue

            # Find nearest horizontal or vertical line
            nearest = self._find_nearest_dimension_line(t, lines)
            if nearest is None:
                continue

            gl = Line(nearest.x0, nearest.y0, nearest.x1, nearest.y1)
            length_pts = line_length(gl)
            if length_pts < 5:
                continue

            # 1 PDF pt = 0.3528 mm
            length_mm_on_paper = length_pts * 0.3528
            scale = real_mm / length_mm_on_paper
            rounded = round(scale / 10) * 10  # Round to nearest 10
            if 20 <= rounded <= 200:
                return float(rounded)

        return None

    def _find_nearest_dimension_line(
        self, text: RawText, lines: list[RawLine], max_dist: float = 30.0
    ) -> RawLine | None:
        """Find the nearest horizontal or vertical line to a dimension text."""
        best_line = None
        best_dist = max_dist

        for line in lines:
            dx = abs(line.x1 - line.x0)
            dy = abs(line.y1 - line.y0)
            # Only consider roughly horizontal or vertical lines
            if min(dx, dy) > max(dx, dy) * 0.1:
                continue
            if max(dx, dy) < 10:
                continue

            mx = (line.x0 + line.x1) / 2
            my = (line.y0 + line.y1) / 2
            dist = ((text.x - mx) ** 2 + (text.y - my) ** 2) ** 0.5
            if dist < best_dist:
                best_dist = dist
                best_line = line

        return best_line

    def extract_room_outlines(
        self, walls: list[dict], page_width: float, page_height: float
    ) -> list[list[tuple[float, float]]]:
        """
        Extract the building outline from the outermost walls.
        Returns a list of outline polygons.
        """
        if not walls:
            return []

        # Collect all wall endpoints to form the building outline
        all_x = []
        all_y = []
        for wall in walls:
            cl = wall["centerline"]
            all_x.extend([cl["x0"], cl["x1"]])
            all_y.extend([cl["y0"], cl["y1"]])

        if not all_x:
            return []

        # Use bounding box of all walls as building outline (simplified)
        min_x, max_x = min(all_x), max(all_x)
        min_y, max_y = min(all_y), max(all_y)

        outline = [
            (min_x, min_y),
            (max_x, min_y),
            (max_x, max_y),
            (min_x, max_y),
        ]

        return [outline]
