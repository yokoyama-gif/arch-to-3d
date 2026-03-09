"""Generate 3D model data from parsed floor plan and elevation data."""

from app.models.schemas import (
    Building3DModel,
    WallSegment,
    DoorData,
    WindowData,
    FloorData,
    RoofData,
    Point2D,
    Point3D,
)
from app.utils.geometry import compute_offset_along_wall


class ModelGenerator:
    def generate(
        self,
        floor_plans: list[dict],
        elevation_data: dict,
        scale: float,
    ) -> Building3DModel:
        """
        Convert parsed 2D data into a 3D building model.

        Args:
            floor_plans: List of per-floor data dicts with keys:
                         walls, doors, windows, outline
            elevation_data: Height data from elevation parser
            scale: Drawing scale denominator (e.g., 100 for 1:100)
        """
        # PDF point to real meters conversion
        pts_to_mm = 0.3528 * scale
        mm_to_m = 0.001
        conversion = pts_to_mm * mm_to_m

        floor_height_m = elevation_data.get("floor_height", 2700) * mm_to_m
        door_height_m = elevation_data.get("door_height", 2000) * mm_to_m
        window_sill_m = elevation_data.get("window_sill", 800) * mm_to_m
        window_height_m = elevation_data.get("window_height", 1200) * mm_to_m

        walls_3d: list[WallSegment] = []
        doors_3d: list[DoorData] = []
        windows_3d: list[WindowData] = []
        floors_3d: list[FloorData] = []

        wall_offset = 0  # Track wall index offset across floors

        for floor_idx, floor_data in enumerate(floor_plans):
            base_elevation = floor_idx * floor_height_m

            # Walls
            for wall in floor_data.get("walls", []):
                cl = wall["centerline"]
                walls_3d.append(
                    WallSegment(
                        start=Point3D(
                            x=cl["x0"] * conversion,
                            y=base_elevation,
                            z=cl["y0"] * conversion,
                        ),
                        end=Point3D(
                            x=cl["x1"] * conversion,
                            y=base_elevation,
                            z=cl["y1"] * conversion,
                        ),
                        height=floor_height_m,
                        thickness=wall.get("thickness", 10) * conversion,
                        is_exterior=wall.get("is_exterior", False),
                    )
                )

            # Doors
            for door in floor_data.get("doors", []):
                cx, cy = door["center"]
                wall_idx = door["wall_index"]
                walls_list = floor_data.get("walls", [])
                offset = 0.5
                if wall_idx < len(walls_list):
                    offset = compute_offset_along_wall(
                        cx, cy, walls_list[wall_idx]
                    )

                doors_3d.append(
                    DoorData(
                        position=Point3D(
                            x=cx * conversion,
                            y=base_elevation,
                            z=cy * conversion,
                        ),
                        width=door["width"] * conversion,
                        height=door_height_m,
                        wall_index=wall_idx + wall_offset,
                        offset_along_wall=offset,
                    )
                )

            # Windows
            for win in floor_data.get("windows", []):
                cx, cy = win["center"]
                wall_idx = win["wall_index"]
                walls_list = floor_data.get("walls", [])
                offset = 0.5
                if wall_idx < len(walls_list):
                    offset = compute_offset_along_wall(
                        cx, cy, walls_list[wall_idx]
                    )

                windows_3d.append(
                    WindowData(
                        position=Point3D(
                            x=cx * conversion,
                            y=base_elevation,
                            z=cy * conversion,
                        ),
                        width=win["width"] * conversion,
                        height=window_height_m,
                        sill_height=window_sill_m,
                        wall_index=win["wall_index"] + wall_offset,
                        offset_along_wall=offset,
                    )
                )

            # Floor plane
            outline = floor_data.get("outline", [])
            if outline:
                floors_3d.append(
                    FloorData(
                        outline=[
                            Point2D(x=p[0] * conversion, y=p[1] * conversion)
                            for p in outline
                        ],
                        elevation=base_elevation,
                        floor_number=floor_idx + 1,
                    )
                )

            wall_offset += len(floor_data.get("walls", []))

        # Compute bounding box
        bbox = self._compute_bounding_box(walls_3d)

        # Roof (simplified)
        roof = None
        if floors_3d:
            top_elevation = (len(floor_plans)) * floor_height_m
            roof_info = elevation_data.get("roof", {"type": "gable"})
            if floors_3d:
                roof = RoofData(
                    type=roof_info.get("type", "gable"),
                    ridge_height=top_elevation + 2.0,
                    outline=floors_3d[-1].outline,
                    base_elevation=top_elevation,
                )

        return Building3DModel(
            walls=walls_3d,
            doors=doors_3d,
            windows=windows_3d,
            floors=floors_3d,
            roof=roof,
            scale_factor=conversion,
            bounding_box=bbox,
        )

    def _compute_bounding_box(self, walls: list[WallSegment]) -> dict:
        if not walls:
            return {
                "min": {"x": 0, "y": 0, "z": 0},
                "max": {"x": 10, "y": 3, "z": 10},
            }

        all_x = []
        all_y = []
        all_z = []
        for w in walls:
            all_x.extend([w.start.x, w.end.x])
            all_y.extend([w.start.y, w.start.y + w.height])
            all_z.extend([w.start.z, w.end.z])

        return {
            "min": {"x": min(all_x), "y": min(all_y), "z": min(all_z)},
            "max": {"x": max(all_x), "y": max(all_y), "z": max(all_z)},
        }
