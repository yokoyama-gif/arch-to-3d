from typing import Literal

from pydantic import BaseModel, Field, model_validator


BoundaryKey = Literal["south", "east", "north", "west"]
VolumeKind = Literal["planned", "context"]
RuleType = Literal["fixed", "road", "adjacent"]
DrawingUnit = Literal["mm", "cm", "m"]


class Point2D(BaseModel):
    x: float
    y: float


class Point3D(BaseModel):
    x: float
    y: float
    z: float


class SiteInput(BaseModel):
    width: float = Field(gt=0, description="敷地幅[m]")
    depth: float = Field(gt=0, description="敷地奥行[m]")


class VolumeInput(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=64)
    x: float = Field(description="左下X座標[m]")
    y: float = Field(description="左下Y座標[m]")
    width: float = Field(gt=0, description="幅[m]")
    depth: float = Field(gt=0, description="奥行[m]")
    height: float = Field(gt=0, description="高さ[m]")
    kind: VolumeKind = "planned"


class BoundaryRule(BaseModel):
    enabled: bool = True
    rule_type: RuleType = "fixed"
    fixed_threshold: float = Field(default=35.0, ge=0, le=100)
    road_width: float = Field(default=4.0, ge=0, le=80)
    setback: float = Field(default=0.0, ge=0, le=30)
    slope: float = Field(default=1.25, gt=0, le=10)
    base_height: float = Field(default=0.0, ge=0, le=100)


class BoundaryRuleSet(BaseModel):
    south: BoundaryRule = BoundaryRule()
    east: BoundaryRule = BoundaryRule()
    north: BoundaryRule = BoundaryRule()
    west: BoundaryRule = BoundaryRule()

    def enabled_boundaries(self) -> list[BoundaryKey]:
        enabled: list[BoundaryKey] = []
        for boundary in ("south", "east", "north", "west"):
            if getattr(self, boundary).enabled:
                enabled.append(boundary)
        return enabled

    def rule_for(self, boundary: BoundaryKey) -> BoundaryRule:
        return getattr(self, boundary)


class EvaluationSettings(BaseModel):
    measurement_height: float = Field(
        default=1.5, gt=0, le=20, description="観測点高さ[m]"
    )
    point_spacing: float = Field(
        default=2.0, gt=0.2, le=20, description="境界上の測点ピッチ[m]"
    )
    boundary_offset: float = Field(
        default=0.1, ge=0, le=5, description="境界から外側へのオフセット[m]"
    )
    sample_azimuth_divisions: int = Field(
        default=144, ge=24, le=720, description="方位分割数"
    )
    sample_altitude_divisions: int = Field(
        default=24, ge=6, le=180, description="仰角分割数"
    )


class SkyFactorRequest(BaseModel):
    site: SiteInput
    boundary_rules: BoundaryRuleSet = BoundaryRuleSet()
    settings: EvaluationSettings = EvaluationSettings()
    volumes: list[VolumeInput] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_request(self) -> "SkyFactorRequest":
        if not self.boundary_rules.enabled_boundaries():
            raise ValueError("少なくとも1つの境界を有効にしてください。")
        return self


class ObservationPoint(BaseModel):
    id: str
    boundary: BoundaryKey
    sequence: int
    position: Point3D
    rule_type: RuleType
    sky_factor: float = Field(ge=0, le=1)
    sky_factor_percent: float = Field(ge=0, le=100)
    reference_sky_factor_percent: float = Field(ge=0, le=100)
    margin_percent: float
    passes: bool


class BoundarySummary(BaseModel):
    boundary: BoundaryKey
    point_count: int
    minimum_percent: float
    minimum_reference_percent: float
    average_percent: float
    maximum_percent: float
    minimum_margin_percent: float
    pass_rate: float


class AnalysisSummary(BaseModel):
    point_count: int
    minimum_percent: float
    minimum_reference_percent: float
    minimum_margin_percent: float
    average_percent: float
    maximum_percent: float
    pass_rate: float
    worst_point_id: str


class SkyFactorResponse(BaseModel):
    site: SiteInput
    volumes: list[VolumeInput]
    boundary_rules: BoundaryRuleSet
    summary: AnalysisSummary
    boundaries: list[BoundarySummary]
    observation_points: list[ObservationPoint]
    assumptions: list[str]


class DrawingImportResponse(BaseModel):
    detected_format: str
    unit: DrawingUnit
    site: SiteInput
    volumes: list[VolumeInput]
    warnings: list[str]
