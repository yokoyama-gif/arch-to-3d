import numpy as np
from math import atan2, degrees, sqrt
from dataclasses import dataclass


@dataclass
class Line:
    x0: float
    y0: float
    x1: float
    y1: float
    width: float = 1.0


def line_angle(line: Line) -> float:
    """Return angle in degrees [0, 180) of a line segment."""
    dx = line.x1 - line.x0
    dy = line.y1 - line.y0
    if dx == 0 and dy == 0:
        return 0.0
    angle = degrees(atan2(dy, dx)) % 180
    return angle


def line_length(line: Line) -> float:
    dx = line.x1 - line.x0
    dy = line.y1 - line.y0
    return sqrt(dx * dx + dy * dy)


def lines_are_parallel(l1: Line, l2: Line, tolerance_deg: float = 3.0) -> bool:
    """Check if two lines are parallel within tolerance."""
    a1 = line_angle(l1)
    a2 = line_angle(l2)
    diff = abs(a1 - a2)
    return diff < tolerance_deg or abs(diff - 180) < tolerance_deg


def point_to_line_distance(px: float, py: float, line: Line) -> float:
    """Perpendicular distance from point to line's infinite extension."""
    dx = line.x1 - line.x0
    dy = line.y1 - line.y0
    length = sqrt(dx * dx + dy * dy)
    if length == 0:
        return sqrt((px - line.x0) ** 2 + (py - line.y0) ** 2)
    return abs(dy * px - dx * py + line.x1 * line.y0 - line.y1 * line.x0) / length


def perpendicular_distance(l1: Line, l2: Line) -> float:
    """Distance between two parallel lines."""
    mx = (l1.x0 + l1.x1) / 2
    my = (l1.y0 + l1.y1) / 2
    return point_to_line_distance(mx, my, l2)


def compute_centerline(l1: Line, l2: Line) -> dict:
    """Compute the centerline between two parallel lines."""
    return {
        "x0": (l1.x0 + l2.x0) / 2,
        "y0": (l1.y0 + l2.y0) / 2,
        "x1": (l1.x1 + l2.x1) / 2,
        "y1": (l1.y1 + l2.y1) / 2,
    }


def lines_overlap_projection(l1: Line, l2: Line, tolerance: float = 5.0) -> bool:
    """Check if two parallel lines overlap when projected onto their shared direction."""
    angle = atan2(l1.y1 - l1.y0, l1.x1 - l1.x0)
    cos_a = np.cos(angle)
    sin_a = np.sin(angle)

    proj1_start = l1.x0 * cos_a + l1.y0 * sin_a
    proj1_end = l1.x1 * cos_a + l1.y1 * sin_a
    proj2_start = l2.x0 * cos_a + l2.y0 * sin_a
    proj2_end = l2.x1 * cos_a + l2.y1 * sin_a

    min1, max1 = min(proj1_start, proj1_end), max(proj1_start, proj1_end)
    min2, max2 = min(proj2_start, proj2_end), max(proj2_start, proj2_end)

    return max1 >= min2 - tolerance and max2 >= min1 - tolerance


def merge_collinear_segments(walls: list[dict], tolerance: float = 5.0) -> list[dict]:
    """Merge wall segments that are collinear and overlapping."""
    if not walls:
        return walls

    merged = []
    used = set()

    for i, w1 in enumerate(walls):
        if i in used:
            continue
        current = dict(w1)
        for j, w2 in enumerate(walls):
            if j <= i or j in used:
                continue
            cl1 = current["centerline"]
            cl2 = w2["centerline"]
            l1 = Line(cl1["x0"], cl1["y0"], cl1["x1"], cl1["y1"])
            l2 = Line(cl2["x0"], cl2["y0"], cl2["x1"], cl2["y1"])

            if lines_are_parallel(l1, l2, tolerance_deg=3.0):
                dist = perpendicular_distance(l1, l2)
                if dist < tolerance and lines_overlap_projection(l1, l2, tolerance):
                    # Merge: extend current to encompass both
                    angle = atan2(l1.y1 - l1.y0, l1.x1 - l1.x0)
                    cos_a = np.cos(angle)
                    sin_a = np.sin(angle)

                    all_pts = [
                        (cl1["x0"], cl1["y0"]),
                        (cl1["x1"], cl1["y1"]),
                        (cl2["x0"], cl2["y0"]),
                        (cl2["x1"], cl2["y1"]),
                    ]
                    projs = [(p[0] * cos_a + p[1] * sin_a, p) for p in all_pts]
                    projs.sort(key=lambda x: x[0])
                    current["centerline"] = {
                        "x0": projs[0][1][0],
                        "y0": projs[0][1][1],
                        "x1": projs[-1][1][0],
                        "y1": projs[-1][1][1],
                    }
                    used.add(j)

        merged.append(current)

    return merged


def find_nearest_wall_index(
    px: float, py: float, walls: list[dict], max_dist: float = 20.0
) -> int | None:
    """Find the index of the nearest wall to a point."""
    best_idx = None
    best_dist = max_dist

    for i, wall in enumerate(walls):
        cl = wall["centerline"]
        wl = Line(cl["x0"], cl["y0"], cl["x1"], cl["y1"])
        dist = point_to_line_distance(px, py, wl)
        if dist < best_dist:
            best_dist = dist
            best_idx = i

    return best_idx


def compute_offset_along_wall(px: float, py: float, wall: dict) -> float:
    """Compute the normalized offset (0.0-1.0) of a point along a wall."""
    cl = wall["centerline"]
    dx = cl["x1"] - cl["x0"]
    dy = cl["y1"] - cl["y0"]
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return 0.5
    t = ((px - cl["x0"]) * dx + (py - cl["y0"]) * dy) / length_sq
    return max(0.0, min(1.0, t))
