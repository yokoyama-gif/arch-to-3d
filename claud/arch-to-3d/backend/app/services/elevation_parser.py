"""Parse elevation drawings to extract height information."""

import re
from app.services.pdf_extractor import RawLine, RawText


class ElevationParser:
    # Default heights in mm (typical Japanese residential)
    DEFAULT_HEIGHTS = {
        "floor_height": 2700,
        "door_height": 2000,
        "window_sill": 800,
        "window_height": 1200,
        "roof_ridge": 4500,
        "foundation": 400,
    }

    def extract_heights(
        self, texts: list[RawText], lines: list[RawLine], scale: float
    ) -> dict:
        """
        Extract height data from elevation drawings.
        Looks for floor level annotations (GL, 1FL, 2FL) and height dimensions.
        """
        heights = dict(self.DEFAULT_HEIGHTS)

        # Find floor level markers
        floor_levels = {}
        for t in texts:
            text = t.text.strip()
            if re.match(r"(GL|[0-9]*FL|RF|[0-9]*F)", text):
                floor_levels[text] = t.y

        # If we found at least two floor levels, compute floor height
        if len(floor_levels) >= 2:
            sorted_levels = sorted(floor_levels.items(), key=lambda x: x[1])
            # PDF y increases downward, but elevation y may be inverted
            for i in range(len(sorted_levels) - 1):
                name1, y1 = sorted_levels[i]
                name2, y2 = sorted_levels[i + 1]
                dist_pts = abs(y2 - y1)
                # Convert PDF pts to real mm: pts * 0.3528 * scale
                real_mm = dist_pts * 0.3528 * scale
                if 2000 < real_mm < 5000:
                    heights["floor_height"] = round(real_mm)

        # Look for dimension annotations with height values
        for t in texts:
            cleaned = t.text.replace(",", "").strip()
            match = re.match(r"^(\d{3,5})$", cleaned)
            if match:
                value = int(match.group(1))
                # Common Japanese residential heights
                if 1900 <= value <= 2200:
                    heights["door_height"] = value
                elif 600 <= value <= 1000:
                    # Could be window sill height
                    heights["window_sill"] = value
                elif 900 <= value <= 1500:
                    heights["window_height"] = value

        return heights

    def detect_roof_type(
        self, lines: list[RawLine], texts: list[RawText]
    ) -> dict:
        """
        Detect roof type from elevation drawing profile.
        Returns roof type and ridge height estimate.
        """
        # Look for text clues
        for t in texts:
            if "切妻" in t.text:
                return {"type": "gable", "pitch_angle": 30}
            elif "寄棟" in t.text:
                return {"type": "hip", "pitch_angle": 25}
            elif "片流" in t.text:
                return {"type": "shed", "pitch_angle": 15}
            elif "陸屋根" in t.text:
                return {"type": "flat", "pitch_angle": 0}

        # Default to gable (most common in Japanese residential)
        return {"type": "gable", "pitch_angle": 25}
