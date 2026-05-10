import type { Drawing, Point, Shape } from '../types/drawing';
import { generateAutoDimensions } from './autoDimensions';
import { buildingCenter, buildingCorners } from './buildingGeometry';
import { computeDimensionGeometry, formatDimensionText } from './dimensions';

// DXF (AutoCAD Drawing Exchange Format) の最小書き出し。
// 対応エンティティ: LINE, LWPOLYLINE, CIRCLE, TEXT
// レイヤ: 敷地 / 道路 / 建物 / 寸法 / 方位
// 単位: mm（変換せずそのまま）
// バージョン: AC1009 (R12) — シンプルでツール互換性が広い

const LAYER = {
  site:     '敷地',
  road:     '道路',
  building: '建物',
  dimension:'寸法',
  compass:  '方位',
} as const;

const COLOR = {
  site:     2,   // 黄
  road:     8,   // 灰
  building: 5,   // 青
  dimension: 1,  // 赤
  compass:  7,   // 白/黒
};

class DxfWriter {
  private lines: string[] = [];

  pair(code: number | string, value: string | number) {
    // DXF はグループコード行 + 値行のペア
    this.lines.push(String(code));
    this.lines.push(String(value));
  }

  begin(section: string)  { this.pair(0, 'SECTION'); this.pair(2, section); }
  end()                   { this.pair(0, 'ENDSEC'); }
  startTable(name: string){ this.pair(0, 'TABLE'); this.pair(2, name); }
  endTable()              { this.pair(0, 'ENDTAB'); }

  layer(name: string, color: number) {
    this.pair(0, 'LAYER');
    this.pair(2, name);
    this.pair(70, 0);
    this.pair(62, color);
    this.pair(6, 'CONTINUOUS');
  }

  line(layer: string, a: Point, b: Point) {
    this.pair(0, 'LINE');
    this.pair(8, layer);
    this.pair(10, a.x); this.pair(20, a.y); this.pair(30, 0);
    this.pair(11, b.x); this.pair(21, b.y); this.pair(31, 0);
  }

  polyline(layer: string, pts: Point[], closed = true) {
    // R12 互換：POLYLINE + 各 VERTEX + SEQEND
    this.pair(0, 'POLYLINE');
    this.pair(8, layer);
    this.pair(66, 1);             // entities follow flag
    this.pair(70, closed ? 1 : 0);
    this.pair(10, 0); this.pair(20, 0); this.pair(30, 0);
    for (const p of pts) {
      this.pair(0, 'VERTEX');
      this.pair(8, layer);
      this.pair(10, p.x); this.pair(20, p.y); this.pair(30, 0);
    }
    this.pair(0, 'SEQEND');
    this.pair(8, layer);
  }

  circle(layer: string, c: Point, r: number) {
    this.pair(0, 'CIRCLE');
    this.pair(8, layer);
    this.pair(10, c.x); this.pair(20, c.y); this.pair(30, 0);
    this.pair(40, r);
  }

  text(layer: string, pos: Point, text: string, height = 250, rotationDeg = 0) {
    this.pair(0, 'TEXT');
    this.pair(8, layer);
    this.pair(10, pos.x); this.pair(20, pos.y); this.pair(30, 0);
    this.pair(40, height);
    this.pair(1, text);
    this.pair(50, rotationDeg);
  }

  toString(): string {
    return this.lines.join('\n');
  }
}

// 図形 → DXF エンティティ
function writeShape(w: DxfWriter, s: Shape) {
  switch (s.type) {
    case 'site':
      if (s.points.length >= 2) w.polyline(LAYER.site, s.points, true);
      break;
    case 'road': {
      // 中心線 + 幅員から左右の外形をポリラインで
      const pts = s.centerLine;
      if (pts.length < 2) return;
      // 中心線
      for (let i = 0; i < pts.length - 1; i++) {
        w.line(LAYER.road, pts[i], pts[i + 1]);
      }
      // 左右の外形（最初の2点のみ簡易対応）
      const a = pts[0], b = pts[1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const half = s.width / 2;
      const offsetSide = (sign: number) => pts.map(p => ({ x: p.x + nx * half * sign, y: p.y + ny * half * sign }));
      w.polyline(LAYER.road, offsetSide(+1), false);
      w.polyline(LAYER.road, offsetSide(-1), false);
      break;
    }
    case 'building': {
      // 回転考慮の 4 隅 (CAD mm) でポリライン化
      const corners: Point[] = buildingCorners(s);
      w.polyline(LAYER.building, corners, true);
      // 名称テキスト（建物中心 = 回転中心の少し下に置く）
      if (s.name) {
        const c = buildingCenter(s);
        w.text(LAYER.building,
          { x: c.x - s.name.length * 100, y: c.y - 100 },
          s.name, 300);
      }
      break;
    }
    case 'dimension': {
      const g = computeDimensionGeometry(s.start, s.end, s.offset);
      // 補助線
      w.line(LAYER.dimension, g.start, g.offStart);
      w.line(LAYER.dimension, g.end,   g.offEnd);
      // 寸法線
      w.line(LAYER.dimension, g.offStart, g.offEnd);
      // 寸法テキスト
      const text = s.text ?? formatDimensionText(s.start, s.end);
      w.text(LAYER.dimension, g.mid, text, 250, g.angleDeg);
      break;
    }
    case 'compass': {
      w.circle(LAYER.compass, s.center, s.radius);
      // 北向きの針（ひし形）
      const r = s.radius;
      const tip   = { x: s.center.x,           y: s.center.y + r };
      const right = { x: s.center.x + r * 0.18, y: s.center.y };
      const back  = { x: s.center.x,           y: s.center.y + r * 0.55 };
      const left  = { x: s.center.x - r * 0.18, y: s.center.y };
      w.polyline(LAYER.compass, [tip, right, back, left], true);
      w.text(LAYER.compass, { x: s.center.x - r * 0.15, y: s.center.y + r + 100 }, 'N', 300);
      break;
    }
  }
}

export interface DxfExportOptions {
  includeAutoDimensions?: boolean;
}

// メイン: Drawing → DXF テキスト
export function drawingToDXF(drawing: Drawing, opts: DxfExportOptions = {}): string {
  const w = new DxfWriter();

  // HEADER（最低限）
  w.begin('HEADER');
  w.pair(9, '$ACADVER'); w.pair(1, 'AC1009');
  w.pair(9, '$INSUNITS'); w.pair(70, 4); // 4 = millimeters
  w.end();

  // TABLES
  w.begin('TABLES');
  w.startTable('LAYER');
  w.pair(70, 5); // estimated max number of entries
  w.layer('0', 7);
  w.layer(LAYER.site,      COLOR.site);
  w.layer(LAYER.road,      COLOR.road);
  w.layer(LAYER.building,  COLOR.building);
  w.layer(LAYER.dimension, COLOR.dimension);
  w.layer(LAYER.compass,   COLOR.compass);
  w.endTable();
  w.end();

  // ENTITIES
  w.begin('ENTITIES');
  for (const s of drawing.shapes) writeShape(w, s);
  if (opts.includeAutoDimensions) {
    const auto = generateAutoDimensions(drawing);
    for (const s of auto) writeShape(w, s);
  }
  w.end();

  w.pair(0, 'EOF');
  return w.toString();
}

// ダウンロード（ブラウザ用）
export function downloadDXF(drawing: Drawing, opts: DxfExportOptions = {}, filename?: string) {
  const text = drawingToDXF(drawing, opts);
  const blob = new Blob([text], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${drawing.name || 'drawing'}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
