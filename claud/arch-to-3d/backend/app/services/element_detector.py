"""Detect architectural elements (walls, doors, windows) from extracted PDF vector data."""

from app.services.pdf_extractor import RawLine, RawArc, RawRect
from app.utils.geometry import (
    Line,
    line_angle,
    line_length,
    lines_are_parallel,
    perpendicular_distance,
    compute_centerline,
    merge_collinear_segments,
    find_nearest_wall_index,
    lines_overlap_projection,
)


class ElementDetector:
    # Thresholds tuned for Japanese architectural PDFs
    WALL_MIN_WIDTH = 0.8  # Min line width for wall candidates (PDF pts)
    WALL_MIN_LENGTH = 10.0  # Min wall length (PDF pts)
    WALL_PARALLEL_DIST_MIN = 2.0  # Min gap between parallel wall lines
    WALL_PARALLEL_DIST_MAX = 25.0  # Max gap between parallel wall lines
    ANGLE_TOLERANCE = 3.0  # Degrees for parallel detection
    DOOR_ARC_RADIUS_MIN = 10.0  # Min arc radius for door symbol
    DOOR_ARC_RADIUS_MAX = 80.0  # Max arc radius for door symbol
    WINDOW_LINE_GROUP_MIN = 2  # Min parallel lines for a window symbol
    WINDOW_LINE_MAX_GAP = 5.0  # Max gap between window indicator lines

    def detect_walls(
        self, lines: list[RawLine], rects: list[RawRect]
    ) -> list[dict]:
        """Detect walls from thick parallel line pairs and narrow filled rectangles."""
        walls = []

        # Method 1: Find parallel line pairs (thick lines)
        thick_lines = [
            l
            for l in lines
            if l.width >= self.WALL_MIN_WIDTH
            and _raw_line_length(l) >= self.WALL_MIN_LENGTH
        ]

        used = set()
        for i, l1 in enumerate(thick_lines):
            if i in used:
                continue
            gl1 = Line(l1.x0, l1.y0, l1.x1, l1.y1, l1.width)

            for j, l2 in enumerate(thick_lines):
                if j <= i or j in used:
                    continue
                gl2 = Line(l2.x0, l2.y0, l2.x1, l2.y1, l2.width)

                if not lines_are_parallel(gl1, gl2, self.ANGLE_TOLERANCE):
                    continue
                if not lines_overlap_projection(gl1, gl2, tolerance=5.0):
                    continue

                dist = perpendicular_distance(gl1, gl2)
                if self.WALL_PARALLEL_DIST_MIN <= dist <= self.WALL_PARALLEL_DIST_MAX:
                    walls.append(
                        {
                            "centerline": compute_centerline(gl1, gl2),
                            "thickness": dist,
                            "is_exterior": l1.width >= 1.5 or l2.width >= 1.5,
                        }
                    )
                    used.add(i)
                    used.add(j)
                    break

        # Method 2: Narrow filled rectangles as walls
        for rect in rects:
            w = abs(rect.x1 - rect.x0)
            h = abs(rect.y1 - rect.y0)
            if w == 0 or h == 0:
                continue
            aspect = max(w, h) / min(w, h)
            if aspect > 3 and min(w, h) < 25:
                if w > h:
                    walls.append(
                        {
                            "centerline": {
                                "x0": rect.x0,
                                "y0": (rect.y0 + rect.y1) / 2,
                                "x1": rect.x1,
                                "y1": (rect.y0 + rect.y1) / 2,
                            },
                            "thickness": h,
                            "is_exterior": rect.fill is not None,
                        }
                    )
                else:
                    walls.append(
                        {
                            "centerline": {
                                "x0": (rect.x0 + rect.x1) / 2,
                                "y0": rect.y0,
                                "x1": (rect.x0 + rect.x1) / 2,
                                "y1": rect.y1,
                            },
                            "thickness": w,
                            "is_exterior": rect.fill is not None,
                        }
                    )

        # Merge collinear wall segments
        walls = merge_collinear_segments(walls)
        return walls

    def detect_doors(
        self, arcs: list[RawArc], walls: list[dict]
    ) -> list[dict]:
        """Detect doors from quarter-circle arcs near walls."""
        doors = []
        for arc in arcs:
            if not (self.DOOR_ARC_RADIUS_MIN <= arc.radius <= self.DOOR_ARC_RADIUS_MAX):
                continue

            wall_idx = find_nearest_wall_index(
                arc.center_x, arc.center_y, walls, max_dist=30.0
            )
            if wall_idx is not None:
                doors.append(
                    {
                        "center": (arc.center_x, arc.center_y),
                        "width": arc.radius * 2,
                        "wall_index": wall_idx,
                        "type": "swing",
                    }
                )
        return doors

    def detect_windows(
        self, lines: list[RawLine], walls: list[dict]
    ) -> list[dict]:
        """Detect windows from thin parallel line groups on walls."""
        thin_lines = [
            l
            for l in lines
            if l.width < self.WALL_MIN_WIDTH and _raw_line_length(l) > 5.0
        ]

        windows = []

        for wall_idx, wall in enumerate(walls):
            cl = wall["centerline"]
            wall_line = Line(cl["x0"], cl["y0"], cl["x1"], cl["y1"])

            # Find thin lines close to this wall
            candidates = []
            for tl in thin_lines:
                gl = Line(tl.x0, tl.y0, tl.x1, tl.y1, tl.width)
                if not lines_are_parallel(wall_line, gl, tolerance_deg=5.0):
                    continue
                dist = perpendicular_distance(wall_line, gl)
                if dist < wall["thickness"] * 1.5:
                    candidates.append(tl)

            # Group nearby parallel thin lines as window indicators
            if len(candidates) >= self.WINDOW_LINE_GROUP_MIN:
                groups = _group_nearby_lines(candidates, self.WINDOW_LINE_MAX_GAP)
                for group in groups:
                    if len(group) >= self.WINDOW_LINE_GROUP_MIN:
                        cx = sum(
                            (l.x0 + l.x1) / 2 for l in group
                        ) / len(group)
                        cy = sum(
                            (l.y0 + l.y1) / 2 for l in group
                        ) / len(group)
                        avg_len = sum(_raw_line_length(l) for l in group) / len(
                            group
                        )
                        windows.append(
                            {
                                "center": (cx, cy),
                                "width": avg_len,
                                "wall_index": wall_idx,
                            }
                        )

        return windows


def _raw_line_length(line: RawLine) -> float:
    dx = line.x1 - line.x0
    dy = line.y1 - line.y0
    return (dx * dx + dy * dy) ** 0.5


def _group_nearby_lines(
    lines: list[RawLine], max_gap: float
) -> list[list[RawLine]]:
    """Group lines that are close to each other perpendicular to their direction."""
    if not lines:
        return []

    sorted_lines = sorted(lines, key=lambda l: (l.x0 + l.x1) / 2)
    groups: list[list[RawLine]] = [[sorted_lines[0]]]

    for line in sorted_lines[1:]:
        last = groups[-1][-1]
        mid_dist = (
            ((line.x0 + line.x1) / 2 - (last.x0 + last.x1) / 2) ** 2
            + ((line.y0 + line.y1) / 2 - (last.y0 + last.y1) / 2) ** 2
        ) ** 0.5
        if mid_dist <= max_gap * 3:
            groups[-1].append(line)
        else:
            groups.append([line])

    return groups
