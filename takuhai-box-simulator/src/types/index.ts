// ===== 基本型 =====
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  depth: number;
}

// ===== 扉の種類 =====
export type DoorType = 'single' | 'double' | 'sliding' | 'auto';

// ===== 扉の開閉方向 =====
export type DoorSwingDirection = 'left' | 'right' | 'both' | 'none';

// ===== オブジェクトの種類 =====
export type PlacedObjectType =
  | 'delivery_box'
  | 'mailbox'
  | 'auto_lock_panel'
  | 'intercom'
  | 'fire_extinguisher'
  | 'pillar'
  | 'door'
  | 'wall'
  | 'obstacle';

// ===== 宅配ボックスカテゴリ =====
export type BoxCategory =
  | 'small'
  | 'medium'
  | 'large'
  | 'mail_integrated'
  | 'slim'
  | 'large_freestanding';

// ===== 宅配ボックスプリセット =====
export interface BoxPreset {
  id: string;
  name: string;
  category: BoxCategory;
  width: number;   // mm
  depth: number;   // mm
  height: number;  // mm
  frontSpace: number;    // 前面必要スペース mm
  maintenanceSpace: number; // メンテナンススペース mm
  hasAnchor: boolean;
  mountType: 'wall' | 'freestanding';
  unitType: 'single' | 'connected';
  hasMailIntegration: boolean;
  isUserDefined?: boolean;
}

// ===== 配置済みオブジェクト =====
export interface PlacedObject {
  id: string;
  type: PlacedObjectType;
  name: string;
  x: number;          // mm (左上基準)
  y: number;          // mm (左上基準)
  width: number;      // mm
  depth: number;      // mm
  height?: number;    // mm
  rotation: number;   // 0, 90, 180, 270
  // 扉関連
  doorType?: DoorType;
  doorSwing?: DoorSwingDirection;
  doorWidth?: number;  // mm
  // 宅配ボックス関連
  presetId?: string;
  frontSpace?: number;
  maintenanceSpace?: number;
  mountType?: 'wall' | 'freestanding';
  // メタ
  color?: string;
  locked?: boolean;
}

// ===== 判定結果 =====
export type JudgmentLevel = 'ok' | 'warning' | 'ng';

export interface JudgmentResult {
  id: string;
  objectId: string;
  level: JudgmentLevel;
  message: string;
  area?: { x: number; y: number; width: number; height: number };
}

// ===== 空間定義 =====
export interface RoomDefinition {
  name: string;
  width: number;   // mm
  depth: number;   // mm
}

// ===== 判定基準設定 =====
export interface JudgmentSettings {
  minCorridorWidth: number;        // 最低通路幅 mm (default: 800)
  recommendedCorridorWidth: number; // 推奨通路幅 mm (default: 1200)
  frontOperationSpace: number;     // 前面操作スペース mm (default: 600)
  doorClearance: number;           // 扉前余裕寸法 mm (default: 800)
  entranceClearance: number;       // 出入口前滞留スペース mm (default: 1200)
}

// ===== プラン（1案） =====
export interface Plan {
  id: string;
  name: string;
  room: RoomDefinition;
  objects: PlacedObject[];
  judgments: JudgmentResult[];
  settings: JudgmentSettings;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

// ===== プロジェクト =====
export interface Project {
  id: string;
  name: string;
  propertyName: string;
  plans: Plan[];
  activePlanId: string;
  userPresets: BoxPreset[];
}

// ===== スコア =====
export interface Score {
  placementEfficiency: number;  // 配置効率
  circulationQuality: number;   // 動線の良さ
  usability: number;            // 利用しやすさ
  spaciousness: number;         // 圧迫感の少なさ
  equipmentCompatibility: number; // 他設備との整合性
  constructability: number;     // 施工性
  total: number;                // 総合点 (100点満点)
}

// ===== 比較データ =====
export interface PlanComparison {
  planId: string;
  planName: string;
  boxCount: number;
  smallCount: number;
  mediumCount: number;
  largeCount: number;
  totalWidth: number;
  occupiedArea: number;
  minCorridorWidth: number;
  ngCount: number;
  warningCount: number;
  score: Score;
  memo: string;
}

// ===== 推奨構成 =====
export interface RecommendedConfig {
  label: string;
  totalBoxes: number;
  small: number;
  medium: number;
  large: number;
  mailIntegrated: number;
}

// ===== テンプレート =====
export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  room: RoomDefinition;
  objects: Omit<PlacedObject, 'id'>[];
}

// ===== キャンバス状態 =====
export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;       // mm
  snapToGrid: boolean;
  snapToWall: boolean;
  showDimensions: boolean;
  showJudgments: boolean;
  showOperationSpace: boolean;
  showDoorSwing: boolean;
}

// ===== ツール =====
export type ToolType = 'select' | 'pan' | 'place' | 'measure';

// ===== UI表示モード =====
export type ViewMode = 'plan' | 'compare' | 'report';
