export type BoundaryKey = "south" | "east" | "north" | "west";
export type VolumeKind = "planned" | "context";
export type RuleType = "fixed" | "road" | "adjacent";
export type DrawingUnit = "mm" | "cm" | "m";

export interface SiteInput {
  width: number;
  depth: number;
}

export interface VolumeInput {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  kind: VolumeKind;
}

export interface BoundaryRule {
  enabled: boolean;
  rule_type: RuleType;
  fixed_threshold: number;
  road_width: number;
  setback: number;
  slope: number;
  base_height: number;
}

export interface BoundaryRuleSet {
  south: BoundaryRule;
  east: BoundaryRule;
  north: BoundaryRule;
  west: BoundaryRule;
}

export interface EvaluationSettings {
  measurement_height: number;
  point_spacing: number;
  boundary_offset: number;
  sample_azimuth_divisions: number;
  sample_altitude_divisions: number;
}

export interface SkyFactorRequest {
  site: SiteInput;
  boundary_rules: BoundaryRuleSet;
  settings: EvaluationSettings;
  volumes: VolumeInput[];
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ObservationPoint {
  id: string;
  boundary: BoundaryKey;
  sequence: number;
  position: Point3D;
  rule_type: RuleType;
  sky_factor: number;
  sky_factor_percent: number;
  reference_sky_factor_percent: number;
  margin_percent: number;
  passes: boolean;
}

export interface BoundarySummary {
  boundary: BoundaryKey;
  point_count: number;
  minimum_percent: number;
  minimum_reference_percent: number;
  average_percent: number;
  maximum_percent: number;
  minimum_margin_percent: number;
  pass_rate: number;
}

export interface AnalysisSummary {
  point_count: number;
  minimum_percent: number;
  minimum_reference_percent: number;
  minimum_margin_percent: number;
  average_percent: number;
  maximum_percent: number;
  pass_rate: number;
  worst_point_id: string;
}

export interface SkyFactorResponse {
  site: SiteInput;
  volumes: VolumeInput[];
  boundary_rules: BoundaryRuleSet;
  summary: AnalysisSummary;
  boundaries: BoundarySummary[];
  observation_points: ObservationPoint[];
  assumptions: string[];
}

export interface DrawingImportResponse {
  detected_format: string;
  unit: DrawingUnit;
  site: SiteInput;
  volumes: VolumeInput[];
  warnings: string[];
}
