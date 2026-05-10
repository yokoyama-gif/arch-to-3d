// 配置図CAD - 共通型定義
// 単位: すべて mm（ミリメートル）。座標系は CAD 標準に近づけ、
// 内部データは「実寸 mm」で持ち、ビュー変換でスクリーン座標に投影する。

export type ToolId =
  | 'select'
  | 'siteLine'
  | 'road'
  | 'building'
  | 'dimension'
  | 'compass'
  | 'delete';

export interface Point {
  x: number; // mm
  y: number; // mm
}

// 図形の基底
export interface ShapeBase {
  id: string;
  type: ShapeType;
  layer?: string;
  locked?: boolean;
}

export type ShapeType =
  | 'site'
  | 'road'
  | 'building'
  | 'dimension'
  | 'compass';

// 敷地: 多角形（閉じたポリゴン）
export interface SiteShape extends ShapeBase {
  type: 'site';
  points: Point[]; // 閉ポリゴン（最後の点と最初の点が連結）
}

// 道路: 中心線 + 幅員（mm）
export interface RoadShape extends ShapeBase {
  type: 'road';
  centerLine: Point[]; // 折れ線
  width: number; // mm
}

// 建物: 矩形（回転角つき）
export interface BuildingShape extends ShapeBase {
  type: 'building';
  origin: Point; // 左下基点 (mm)
  width: number; // mm (X方向)
  depth: number; // mm (Y方向)
  rotation?: number; // 度 (反時計回り)
  name?: string;
}

// 寸法線: 2点間
export interface DimensionShape extends ShapeBase {
  type: 'dimension';
  start: Point;
  end: Point;
  offset: number; // 寸法補助線方向のオフセット (mm)
  text?: string;  // 自動計算する場合は省略可
}

// 方位記号
export interface CompassShape extends ShapeBase {
  type: 'compass';
  center: Point;
  radius: number; // mm
  northAngle: number; // 北方向の角度 (度) - 通常は90度（上）
}

export type Shape =
  | SiteShape
  | RoadShape
  | BuildingShape
  | DimensionShape
  | CompassShape;

// 図面全体
export interface Drawing {
  id: string;
  name: string;
  scale: number; // 1/100 → 100
  unit: 'mm';
  shapes: Shape[];
  meta?: {
    siteAreaTatsubo?: number;
    coverageRatio?: number;   // 建ぺい率 (将来用)
    floorAreaRatio?: number;  // 容積率 (将来用)
  };
}

// ビューポート（パン・ズーム用、将来拡張）
export interface Viewport {
  offsetX: number; // px
  offsetY: number; // px
  zoom: number;    // 1.0 = 等倍
}

// ツール定義（UI 用）
export interface ToolDefinition {
  id: ToolId;
  label: string;          // 日本語ラベル
  shortcut?: string;      // ショートカット表示用
  guide: string;          // 操作ガイド本文
  cursor?: string;        // CSSカーソル
}

// コマンド進行状態（CAD 風の段階入力管理）
// 「コマンド開始 → 1点目 → 2点目 → 確定」のような段階を State 機械で表現する。
export type InputState =
  | { kind: 'idle' }
  | { kind: 'site-drawing'; points: Point[] }              // 敷地線：点を順次クリック
  | { kind: 'building-corner1' }                            // 建物：1点目待ち
  | { kind: 'building-corner2'; first: Point }              // 建物：2点目待ち
  | { kind: 'road-point1' }                                 // 道路：始点待ち
  | { kind: 'road-point2'; first: Point }                   // 道路：終点待ち
  | { kind: 'dimension-point1' }                            // 寸法：1点目待ち
  | { kind: 'dimension-point2'; first: Point }              // 寸法：2点目待ち
  | { kind: 'compass-place' };                              // 方位：配置位置待ち
