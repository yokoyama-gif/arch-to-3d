from __future__ import annotations

from dataclasses import dataclass
from math import ceil, cos, inf, pi, sin

from app.models.schemas import (
    AnalysisSummary,
    BoundaryKey,
    BoundaryRule,
    BoundarySummary,
    ObservationPoint,
    Point3D,
    SkyFactorRequest,
    SkyFactorResponse,
    VolumeInput,
)


@dataclass(frozen=True)
class DirectionSample:
    dx: float
    dy: float
    dz: float
    weight: float


@dataclass(frozen=True)
class BoundaryPoint:
    boundary: BoundaryKey
    sequence: int
    x: float
    y: float
    z: float


class SkyFactorService:
    def analyze(self, request: SkyFactorRequest) -> SkyFactorResponse:
        directions = self._build_direction_samples(
            request.settings.sample_azimuth_divisions,
            request.settings.sample_altitude_divisions,
        )
        boundary_points = self._build_boundary_points(request)
        reference_cache: dict[BoundaryKey, list[VolumeInput]] = {}

        observation_points: list[ObservationPoint] = []
        for point in boundary_points:
            rule = request.boundary_rules.rule_for(point.boundary)
            actual_factor = self._compute_sky_factor(point, directions, request.volumes)
            reference_percent = self._compute_reference_percent(
                point,
                rule,
                directions,
                request,
                reference_cache,
            )
            actual_percent = round(actual_factor * 100, 2)
            margin = round(actual_percent - reference_percent, 2)

            observation_points.append(
                ObservationPoint(
                    id=f"{point.boundary}-{point.sequence:02d}",
                    boundary=point.boundary,
                    sequence=point.sequence,
                    position=Point3D(x=point.x, y=point.y, z=point.z),
                    rule_type=rule.rule_type,
                    sky_factor=actual_factor,
                    sky_factor_percent=actual_percent,
                    reference_sky_factor_percent=reference_percent,
                    margin_percent=margin,
                    passes=margin >= 0,
                )
            )

        summaries = [
            self._summarize_boundary(boundary, observation_points)
            for boundary in request.boundary_rules.enabled_boundaries()
        ]
        overall = self._summarize_all(observation_points)

        return SkyFactorResponse(
            site=request.site,
            volumes=request.volumes,
            boundary_rules=request.boundary_rules,
            summary=overall,
            boundaries=summaries,
            observation_points=observation_points,
            assumptions=[
                "天空率は上半球サンプリングによる近似計算です。",
                "道路斜線の観測点は対向道路境界側に配置しています。",
                "基準天空率の適合建築物は、境界ごとの斜線条件を階段状ボリュームで近似しています。",
                "建物形状は直方体ボリュームとして評価しています。",
            ],
        )

    def _build_direction_samples(
        self, azimuth_divisions: int, altitude_divisions: int
    ) -> list[DirectionSample]:
        samples: list[DirectionSample] = []

        for altitude_index in range(altitude_divisions):
            altitude_min = (altitude_index / altitude_divisions) * (pi / 2)
            altitude_max = ((altitude_index + 1) / altitude_divisions) * (pi / 2)
            altitude = (altitude_min + altitude_max) / 2
            band_weight = (
                sin(altitude_max) ** 2 - sin(altitude_min) ** 2
            ) / azimuth_divisions

            for azimuth_index in range(azimuth_divisions):
                azimuth = ((azimuth_index + 0.5) / azimuth_divisions) * 2 * pi
                horizontal = cos(altitude)
                samples.append(
                    DirectionSample(
                        dx=horizontal * cos(azimuth),
                        dy=horizontal * sin(azimuth),
                        dz=sin(altitude),
                        weight=band_weight,
                    )
                )

        return samples

    def _build_boundary_points(
        self, request: SkyFactorRequest
    ) -> list[BoundaryPoint]:
        z = request.settings.measurement_height
        width = request.site.width
        depth = request.site.depth
        boundary_points: list[BoundaryPoint] = []

        for boundary in request.boundary_rules.enabled_boundaries():
            rule = request.boundary_rules.rule_for(boundary)
            length = width if boundary in {"south", "north"} else depth
            spacing = request.settings.point_spacing
            if rule.rule_type == "road":
                spacing = min(spacing, max(rule.road_width / 2, 0.5))
            positions = self._sample_positions(length, spacing)
            for sequence, distance in enumerate(positions, start=1):
                x, y = self._boundary_coordinates(boundary, distance, request, rule)
                boundary_points.append(
                    BoundaryPoint(
                        boundary=boundary,
                        sequence=sequence,
                        x=x,
                        y=y,
                        z=z,
                    )
                )

        return boundary_points

    def _sample_positions(self, length: float, spacing: float) -> list[float]:
        segments = max(1, ceil(length / spacing))
        return [(length * index) / segments for index in range(segments + 1)]

    def _boundary_coordinates(
        self,
        boundary: BoundaryKey,
        distance: float,
        request: SkyFactorRequest,
        rule: BoundaryRule,
    ) -> tuple[float, float]:
        road_offset = rule.road_width + request.settings.boundary_offset
        edge_offset = request.settings.boundary_offset
        width = request.site.width
        depth = request.site.depth

        if boundary == "south":
            y = -road_offset if rule.rule_type == "road" else -edge_offset
            return distance, y
        if boundary == "north":
            y = depth + road_offset if rule.rule_type == "road" else depth + edge_offset
            return distance, y
        if boundary == "east":
            x = width + road_offset if rule.rule_type == "road" else width + edge_offset
            return x, distance
        x = -road_offset if rule.rule_type == "road" else -edge_offset
        return x, distance

    def _compute_reference_percent(
        self,
        point: BoundaryPoint,
        rule: BoundaryRule,
        directions: list[DirectionSample],
        request: SkyFactorRequest,
        reference_cache: dict[BoundaryKey, list[VolumeInput]],
    ) -> float:
        if rule.rule_type == "fixed":
            return round(rule.fixed_threshold, 2)

        if point.boundary not in reference_cache:
            reference_cache[point.boundary] = self._build_reference_volumes(
                request,
                point.boundary,
            )

        reference_factor = self._compute_sky_factor(
            point,
            directions,
            reference_cache[point.boundary],
        )
        return round(reference_factor * 100, 2)

    def _build_reference_volumes(
        self,
        request: SkyFactorRequest,
        boundary: BoundaryKey,
    ) -> list[VolumeInput]:
        rule = request.boundary_rules.rule_for(boundary)
        cell_size = max(1.0, min(request.settings.point_spacing, 2.0))
        x_count = max(1, ceil(request.site.width / cell_size))
        y_count = max(1, ceil(request.site.depth / cell_size))
        volumes: list[VolumeInput] = []

        for ix in range(x_count):
            x0 = request.site.width * ix / x_count
            x1 = request.site.width * (ix + 1) / x_count
            x_center = (x0 + x1) / 2
            for iy in range(y_count):
                y0 = request.site.depth * iy / y_count
                y1 = request.site.depth * (iy + 1) / y_count
                y_center = (y0 + y1) / 2
                distance = self._distance_from_boundary(boundary, x_center, y_center, request)
                height = self._reference_height(rule, distance)
                volumes.append(
                    VolumeInput(
                        id=f"ref-{boundary}-{ix}-{iy}",
                        name=f"reference-{boundary}",
                        x=x0,
                        y=y0,
                        width=x1 - x0,
                        depth=y1 - y0,
                        height=max(height, 0.1),
                        kind="context",
                    )
                )

        return volumes

    def _distance_from_boundary(
        self,
        boundary: BoundaryKey,
        x: float,
        y: float,
        request: SkyFactorRequest,
    ) -> float:
        if boundary == "south":
            return y
        if boundary == "north":
            return request.site.depth - y
        if boundary == "east":
            return request.site.width - x
        return x

    def _reference_height(self, rule: BoundaryRule, distance: float) -> float:
        if rule.rule_type == "road":
            return rule.base_height + rule.slope * (rule.road_width + rule.setback + distance)
        return rule.base_height + rule.slope * (rule.setback + distance)

    def _compute_sky_factor(
        self,
        point: BoundaryPoint,
        directions: list[DirectionSample],
        volumes: list[VolumeInput],
    ) -> float:
        visible_weight = 0.0
        for direction in directions:
            if not self._direction_is_blocked(point, direction, volumes):
                visible_weight += direction.weight

        return min(max(visible_weight, 0.0), 1.0)

    def _direction_is_blocked(
        self,
        point: BoundaryPoint,
        direction: DirectionSample,
        volumes: list[VolumeInput],
    ) -> bool:
        origin = (point.x, point.y, point.z)
        ray = (direction.dx, direction.dy, direction.dz)

        for volume in volumes:
            if self._ray_hits_volume(origin, ray, volume):
                return True
        return False

    def _ray_hits_volume(
        self,
        origin: tuple[float, float, float],
        direction: tuple[float, float, float],
        volume: VolumeInput,
    ) -> bool:
        bounds_min = (volume.x, volume.y, 0.0)
        bounds_max = (volume.x + volume.width, volume.y + volume.depth, volume.height)

        t_min = -inf
        t_max = inf

        for axis in range(3):
            origin_axis = origin[axis]
            direction_axis = direction[axis]
            minimum = bounds_min[axis]
            maximum = bounds_max[axis]

            if abs(direction_axis) < 1e-9:
                if origin_axis < minimum or origin_axis > maximum:
                    return False
                continue

            inverse = 1.0 / direction_axis
            t1 = (minimum - origin_axis) * inverse
            t2 = (maximum - origin_axis) * inverse
            near = min(t1, t2)
            far = max(t1, t2)

            t_min = max(t_min, near)
            t_max = min(t_max, far)

            if t_min > t_max:
                return False

        return t_max >= max(t_min, 0.0)

    def _summarize_boundary(
        self, boundary: BoundaryKey, observation_points: list[ObservationPoint]
    ) -> BoundarySummary:
        boundary_points = [
            point for point in observation_points if point.boundary == boundary
        ]
        actual_values = [point.sky_factor_percent for point in boundary_points]
        reference_values = [point.reference_sky_factor_percent for point in boundary_points]
        margins = [point.margin_percent for point in boundary_points]
        pass_count = sum(1 for point in boundary_points if point.passes)

        return BoundarySummary(
            boundary=boundary,
            point_count=len(boundary_points),
            minimum_percent=round(min(actual_values), 2),
            minimum_reference_percent=round(min(reference_values), 2),
            average_percent=round(sum(actual_values) / len(actual_values), 2),
            maximum_percent=round(max(actual_values), 2),
            minimum_margin_percent=round(min(margins), 2),
            pass_rate=round((pass_count / len(boundary_points)) * 100, 2),
        )

    def _summarize_all(self, observation_points: list[ObservationPoint]) -> AnalysisSummary:
        actual_values = [point.sky_factor_percent for point in observation_points]
        reference_values = [point.reference_sky_factor_percent for point in observation_points]
        margins = [point.margin_percent for point in observation_points]
        pass_count = sum(1 for point in observation_points if point.passes)
        worst_point = min(observation_points, key=lambda point: point.margin_percent)

        return AnalysisSummary(
            point_count=len(observation_points),
            minimum_percent=round(min(actual_values), 2),
            minimum_reference_percent=round(min(reference_values), 2),
            minimum_margin_percent=round(min(margins), 2),
            average_percent=round(sum(actual_values) / len(actual_values), 2),
            maximum_percent=round(max(actual_values), 2),
            pass_rate=round((pass_count / len(observation_points)) * 100, 2),
            worst_point_id=worst_point.id,
        )
