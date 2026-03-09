from __future__ import annotations

from dataclasses import dataclass
import re
import subprocess
import tempfile
from pathlib import Path

from app.config import JWC_CONVERTER_COMMAND
from app.models.schemas import DrawingImportResponse, DrawingUnit, SiteInput, VolumeInput


class DrawingImportError(Exception):
    pass


@dataclass(frozen=True)
class DxfEntity:
    entity_type: str
    layer: str
    points: list[tuple[float, float]]
    closed: bool = False


class DrawingImportService:
    HEIGHT_PATTERN = re.compile(
        r"(?:height|h|高さ)\s*[:=_-]?\s*([0-9]+(?:\.[0-9]+)?)",
        re.IGNORECASE,
    )

    def import_drawing(
        self,
        drawing_path: Path,
        unit: str,
        default_planned_height: float,
        default_context_height: float,
    ) -> DrawingImportResponse:
        normalized_unit = self._normalize_unit(unit)
        suffix = drawing_path.suffix.lower()

        if suffix == ".dxf":
            entities = self._parse_dxf_file(drawing_path)
            detected_format = "dxf"
        elif suffix in {".jww", ".jwc"}:
            entities = self._parse_converted_jw_file(drawing_path)
            detected_format = suffix.lstrip(".")
        else:
            raise DrawingImportError("対応形式は DXF / JWW / JWC のみです。")

        return self._build_import_response(
            entities,
            normalized_unit,
            default_planned_height,
            default_context_height,
            detected_format,
        )

    def _normalize_unit(self, unit: str) -> DrawingUnit:
        if unit not in {"mm", "cm", "m"}:
            raise DrawingImportError("単位は mm / cm / m のいずれかを指定してください。")
        return unit  # type: ignore[return-value]

    def _parse_converted_jw_file(self, drawing_path: Path) -> list[DxfEntity]:
        if not JWC_CONVERTER_COMMAND:
            raise DrawingImportError(
                "JWW/JWC の直接解析は未実装です。環境変数 JWC_CONVERTER_COMMAND に DXF 変換コマンドを設定するか、DXF に変換して取り込んでください。"
            )

        with tempfile.TemporaryDirectory() as temp_dir:
            dxf_path = Path(temp_dir) / "converted.dxf"
            command = JWC_CONVERTER_COMMAND.format(
                input=str(drawing_path),
                output=str(dxf_path),
            )
            try:
                subprocess.run(
                    command,
                    shell=True,
                    check=True,
                    timeout=120,
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
                raise DrawingImportError(
                    "JWW/JWC の DXF 変換に失敗しました。変換コマンドを確認してください。"
                ) from exc

            if not dxf_path.exists():
                raise DrawingImportError(
                    "JWW/JWC 変換後の DXF が生成されませんでした。"
                )

            return self._parse_dxf_file(dxf_path)

    def _parse_dxf_file(self, drawing_path: Path) -> list[DxfEntity]:
        text = self._read_text(drawing_path)
        pairs = self._read_pairs(text)
        entities: list[DxfEntity] = []
        in_entities = False
        index = 0

        while index < len(pairs):
            code, value = pairs[index]

            if code == "0" and value == "SECTION":
                if (
                    index + 1 < len(pairs)
                    and pairs[index + 1][0] == "2"
                    and pairs[index + 1][1] == "ENTITIES"
                ):
                    in_entities = True
                index += 1
                continue

            if code == "0" and value == "ENDSEC":
                in_entities = False
                index += 1
                continue

            if not in_entities or code != "0":
                index += 1
                continue

            if value == "LWPOLYLINE":
                entity, index = self._parse_lwpolyline(pairs, index + 1)
                if entity:
                    entities.append(entity)
                continue

            if value == "LINE":
                entity, index = self._parse_line(pairs, index + 1)
                if entity:
                    entities.append(entity)
                continue

            if value == "POLYLINE":
                entity, index = self._parse_polyline(pairs, index + 1)
                if entity:
                    entities.append(entity)
                continue

            index = self._skip_entity(pairs, index + 1)

        if not entities:
            raise DrawingImportError("DXF から読める図形が見つかりませんでした。")

        return entities

    def _read_text(self, drawing_path: Path) -> str:
        for encoding in ("utf-8", "cp932", "latin-1"):
            try:
                return drawing_path.read_text(encoding=encoding)
            except UnicodeDecodeError:
                continue
        raise DrawingImportError("DXF の文字コードを判別できませんでした。")

    def _read_pairs(self, text: str) -> list[tuple[str, str]]:
        lines = [line.rstrip("\r") for line in text.split("\n") if line is not None]
        if len(lines) < 2:
            raise DrawingImportError("DXF の内容が不正です。")
        if len(lines) % 2 == 1:
            lines = lines[:-1]
        return [
            (lines[index].strip(), lines[index + 1].strip())
            for index in range(0, len(lines), 2)
        ]

    def _parse_lwpolyline(
        self,
        pairs: list[tuple[str, str]],
        index: int,
    ) -> tuple[DxfEntity | None, int]:
        layer = "0"
        closed = False
        points: list[tuple[float, float]] = []
        pending_x: float | None = None

        while index < len(pairs) and pairs[index][0] != "0":
            code, value = pairs[index]
            if code == "8":
                layer = value
            elif code == "70":
                try:
                    closed = int(value) & 1 == 1
                except ValueError:
                    closed = False
            elif code == "10":
                pending_x = float(value)
            elif code == "20" and pending_x is not None:
                points.append((pending_x, float(value)))
                pending_x = None
            index += 1

        if len(points) < 2:
            return None, index
        return DxfEntity("LWPOLYLINE", layer, points, closed), index

    def _parse_line(
        self,
        pairs: list[tuple[str, str]],
        index: int,
    ) -> tuple[DxfEntity | None, int]:
        layer = "0"
        x0 = y0 = x1 = y1 = None

        while index < len(pairs) and pairs[index][0] != "0":
            code, value = pairs[index]
            if code == "8":
                layer = value
            elif code == "10":
                x0 = float(value)
            elif code == "20":
                y0 = float(value)
            elif code == "11":
                x1 = float(value)
            elif code == "21":
                y1 = float(value)
            index += 1

        if None in {x0, y0, x1, y1}:
            return None, index
        return DxfEntity("LINE", layer, [(x0, y0), (x1, y1)]), index

    def _parse_polyline(
        self,
        pairs: list[tuple[str, str]],
        index: int,
    ) -> tuple[DxfEntity | None, int]:
        layer = "0"
        closed = False

        while index < len(pairs) and pairs[index][0] != "0":
            code, value = pairs[index]
            if code == "8":
                layer = value
            elif code == "70":
                try:
                    closed = int(value) & 1 == 1
                except ValueError:
                    closed = False
            index += 1

        points: list[tuple[float, float]] = []
        while index < len(pairs):
            code, value = pairs[index]
            if code != "0":
                index += 1
                continue
            if value == "VERTEX":
                index += 1
                x = y = None
                while index < len(pairs) and pairs[index][0] != "0":
                    vertex_code, vertex_value = pairs[index]
                    if vertex_code == "10":
                        x = float(vertex_value)
                    elif vertex_code == "20":
                        y = float(vertex_value)
                    index += 1
                if x is not None and y is not None:
                    points.append((x, y))
                continue
            if value == "SEQEND":
                index += 1
                break
            break

        if len(points) < 2:
            return None, index
        return DxfEntity("POLYLINE", layer, points, closed), index

    def _skip_entity(self, pairs: list[tuple[str, str]], index: int) -> int:
        while index < len(pairs) and pairs[index][0] != "0":
            index += 1
        return index

    def _build_import_response(
        self,
        entities: list[DxfEntity],
        unit: DrawingUnit,
        default_planned_height: float,
        default_context_height: float,
        detected_format: str,
    ) -> DrawingImportResponse:
        scale = {"mm": 0.001, "cm": 0.01, "m": 1.0}[unit]
        warnings: list[str] = []
        site_candidates: list[tuple[float, float, float, float]] = []
        grouped_lines: dict[tuple[str, str], list[tuple[float, float]]] = {}
        footprint_entities: list[tuple[str, DxfEntity]] = []
        all_points: list[tuple[float, float]] = []

        for entity in entities:
            all_points.extend(entity.points)
            category = self._classify_layer(entity.layer)
            if entity.closed and len(entity.points) >= 3:
                if category == "site":
                    site_candidates.append(self._bbox(entity.points))
                elif category in {"planned", "context"}:
                    footprint_entities.append((category, entity))
                else:
                    warnings.append(
                        f"レイヤ '{entity.layer}' は用途を判定できなかったため無視しました。"
                    )
            else:
                grouped_lines.setdefault((category, entity.layer), []).extend(entity.points)

        if site_candidates:
            site_bbox = max(site_candidates, key=self._bbox_area)
        else:
            site_line_points = [
                points for (category, _), points in grouped_lines.items() if category == "site"
            ]
            if site_line_points:
                merged_site_points = [point for points in site_line_points for point in points]
                site_bbox = self._bbox(merged_site_points)
                warnings.append("敷地は線分群から外接矩形で近似しました。")
            elif all_points:
                site_bbox = self._bbox(all_points)
                warnings.append("敷地レイヤが見つからなかったため、全図形の外接矩形を敷地として扱いました。")
            else:
                raise DrawingImportError("取り込み可能な図形が見つかりませんでした。")

        site_origin_x, site_origin_y, site_max_x, site_max_y = site_bbox
        site = SiteInput(
            width=round((site_max_x - site_origin_x) * scale, 3),
            depth=round((site_max_y - site_origin_y) * scale, 3),
        )

        volumes: list[VolumeInput] = []
        for category, entity in footprint_entities:
            bbox = self._bbox(entity.points)
            if not self._is_axis_aligned(entity.points):
                warnings.append(
                    f"レイヤ '{entity.layer}' の図形は外接矩形に置換しました。"
                )
            volume = self._volume_from_bbox(
                bbox,
                entity.layer,
                category,
                site_origin_x,
                site_origin_y,
                scale,
                default_planned_height,
                default_context_height,
            )
            if volume:
                volumes.append(volume)

        for (category, layer), points in grouped_lines.items():
            if category not in {"planned", "context"} or not points:
                continue
            warnings.append(
                f"レイヤ '{layer}' は閉図形でなかったため、線分群の外接矩形で近似しました。"
            )
            volume = self._volume_from_bbox(
                self._bbox(points),
                layer,
                category,
                site_origin_x,
                site_origin_y,
                scale,
                default_planned_height,
                default_context_height,
            )
            if volume:
                volumes.append(volume)

        if not volumes:
            raise DrawingImportError(
                "計画棟または周辺棟として認識できる図形がありませんでした。レイヤ名に planned / 計画 / context / 周辺 などを含めてください。"
            )

        return DrawingImportResponse(
            detected_format=detected_format,
            unit=unit,
            site=site,
            volumes=volumes,
            warnings=self._deduplicate_warnings(warnings),
        )

    def _classify_layer(self, layer_name: str) -> str:
        normalized = layer_name.lower()
        if any(token in normalized for token in ["site", "敷地", "boundary"]):
            return "site"
        if any(token in normalized for token in ["planned", "proposal", "計画"]):
            return "planned"
        if any(token in normalized for token in ["context", "neighbor", "existing", "周辺", "隣地", "既存"]):
            return "context"
        if "建物" in layer_name or "building" in normalized:
            return "planned"
        return "unknown"

    def _bbox(self, points: list[tuple[float, float]]) -> tuple[float, float, float, float]:
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        return min(xs), min(ys), max(xs), max(ys)

    def _bbox_area(self, bbox: tuple[float, float, float, float]) -> float:
        return max(bbox[2] - bbox[0], 0) * max(bbox[3] - bbox[1], 0)

    def _is_axis_aligned(self, points: list[tuple[float, float]]) -> bool:
        if len(points) < 2:
            return True
        for index in range(len(points)):
            x0, y0 = points[index]
            x1, y1 = points[(index + 1) % len(points)]
            if abs(x0 - x1) > 1e-6 and abs(y0 - y1) > 1e-6:
                return False
        return True

    def _volume_from_bbox(
        self,
        bbox: tuple[float, float, float, float],
        layer_name: str,
        category: str,
        site_origin_x: float,
        site_origin_y: float,
        scale: float,
        default_planned_height: float,
        default_context_height: float,
    ) -> VolumeInput | None:
        min_x, min_y, max_x, max_y = bbox
        width = round((max_x - min_x) * scale, 3)
        depth = round((max_y - min_y) * scale, 3)
        if width <= 0 or depth <= 0:
            return None

        raw_height = self._parse_height_from_layer(layer_name)
        default_height = (
            default_planned_height if category == "planned" else default_context_height
        )
        height = self._normalize_height(raw_height, scale, default_height)

        return VolumeInput(
            id=f"{(re.sub(r'[^a-zA-Z0-9_-]', '-', layer_name)[:18] or category)}-{int(min_x)}-{int(min_y)}",
            name=layer_name,
            x=round((min_x - site_origin_x) * scale, 3),
            y=round((min_y - site_origin_y) * scale, 3),
            width=width,
            depth=depth,
            height=round(height, 3),
            kind="planned" if category == "planned" else "context",
        )

    def _parse_height_from_layer(self, layer_name: str) -> float | None:
        match = self.HEIGHT_PATTERN.search(layer_name)
        if not match:
            return None
        return float(match.group(1))

    def _normalize_height(
        self,
        raw_height: float | None,
        scale: float,
        default_height: float,
    ) -> float:
        if raw_height is None:
            return default_height
        if raw_height >= 100 and scale != 1.0:
            return raw_height * scale
        return raw_height

    def _deduplicate_warnings(self, warnings: list[str]) -> list[str]:
        deduplicated: list[str] = []
        seen: set[str] = set()
        for warning in warnings:
            if warning not in seen:
                seen.add(warning)
                deduplicated.append(warning)
        return deduplicated

