// 共通型定義（拡張可）。寸法は mm 単位で扱う。

export type ID = string;

export type ObjectKind =
  | "desk1"
  | "desk-island-4"
  | "desk-island-free"
  | "meeting-4"
  | "meeting-6"
  | "storage"
  | "locker"
  | "copier"
  | "reception"
  | "sofa"
  | "booth"
  | "pillar"
  | "door"
  | "obstacle";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** ライブラリ項目（プリセット定義） */
export interface LibraryItem {
  id: string;
  kind: ObjectKind;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  /** 1個あたりの座席数（机/会議卓のみ意味あり） */
  seats?: number;
  /** 椅子引き代 (mm) */
  chairClearance?: number;
  /** 操作スペース (mm) */
  frontClearance?: number;
  /** カテゴリ表示用 */
  category: "desk" | "meeting" | "storage" | "service" | "lounge" | "structure";
  metadata?: Record<string, unknown>;
}

/** 配置済みオブジェクト */
export interface LayoutObject {
  id: ID;
  kind: ObjectKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0/90/180/270 度のみ */
  rotation: 0 | 90 | 180 | 270;
  seats?: number;
  chairClearance?: number;
  frontClearance?: number;
  metadata?: Record<string, unknown>;
}

export interface Room {
  width: number;
  height: number;
}

export interface Zone {
  id: ID;
  label: string;
  rect: Rect;
  color: string;
}

export interface ProjectSettings {
  gridSize: number;
  minAisleWidth: number;
  showGrid: boolean;
  snapToGrid: boolean;
  unit: "mm";
}

export interface LayoutPlan {
  id: ID;
  name: string;
  room: Room;
  objects: LayoutObject[];
  zones: Zone[];
  metadata?: Record<string, unknown>;
}

export interface Project {
  id: ID;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  plans: LayoutPlan[];
  activePlanId: ID;
}

export type IssueSeverity = "ok" | "warn" | "ng";

export interface Issue {
  id: ID;
  /** 発生対象オブジェクト（部屋全体の場合は null） */
  objectId: ID | null;
  rule: string;
  severity: IssueSeverity;
  message: string;
}

export interface EvaluationResult {
  totalSeats: number;
  meetingSeats: number;
  occupancyRatio: number;
  minAisleWidth: number;
  warnCount: number;
  ngCount: number;
  score: number;
  issues: Issue[];
}
