import { jsPDF } from 'jspdf';
import type { Drawing, Point, Shape } from '../types/drawing';
import { bbox } from './geometry';
import { generateAutoDimensions } from './autoDimensions';
import { buildingCenter, buildingCorners } from './buildingGeometry';
import { computeDimensionGeometry, formatDimensionText } from './dimensions';
import { mm2ToM2, polygonArea } from './geometry';

// PDF 出力（A3 横、配置図向け）
// jsPDF は単位 mm を直接扱えるので世界 mm → 紙面 mm 変換のみ。
// 紙面に収まるよう自動 fit + 縮尺表示。

export interface PdfExportOptions {
  includeAutoDimensions?: boolean;
  paper?: 'A4' | 'A3';
  orientation?: 'landscape' | 'portrait';
}

interface Layout {
  pageW: number; pageH: number;
  drawX: number; drawY: number; drawW: number; drawH: number;
  worldMinX: number; worldMinY: number;
  pdfPerWorldMM: number; // 紙面mm / 世界mm
  worldScaleDenom: number; // 1/N の N
}

const PAPER_SIZES = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
};
const MARGIN_MM = 12;
const TITLEBLOCK_H = 30;

function collectPoints(shapes: Shape[]): Point[] {
  const all: Point[] = [];
  for (const s of shapes) {
    switch (s.type) {
      case 'site':       all.push(...s.points); break;
      case 'road':       all.push(...s.centerLine); break;
      case 'building':   {
        const { origin: o, width: w, depth: d } = s;
        all.push({ x: o.x, y: o.y }, { x: o.x + w, y: o.y + d });
        break;
      }
      case 'dimension':  all.push(s.start, s.end); break;
      case 'compass':    all.push(
        { x: s.center.x - s.radius, y: s.center.y - s.radius },
        { x: s.center.x + s.radius, y: s.center.y + s.radius },
      ); break;
    }
  }
  return all;
}

function makeLayout(drawing: Drawing, opts: PdfExportOptions): Layout {
  const paper = PAPER_SIZES[opts.paper ?? 'A3'];
  const landscape = (opts.orientation ?? 'landscape') === 'landscape';
  const pageW = landscape ? Math.max(paper.w, paper.h) : Math.min(paper.w, paper.h);
  const pageH = landscape ? Math.min(paper.w, paper.h) : Math.max(paper.w, paper.h);

  const drawX = MARGIN_MM;
  const drawY = MARGIN_MM;
  const drawW = pageW - MARGIN_MM * 2;
  const drawH = pageH - MARGIN_MM * 2 - TITLEBLOCK_H;

  const all = collectPoints(drawing.shapes);
  const b = all.length > 0 ? bbox(all) : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const padW = b.maxX - b.minX + 4000; // 4m 余白
  const padH = b.maxY - b.minY + 4000;
  const sx = drawW / padW;
  const sy = drawH / padH;
  const pdfPerWorldMM = Math.min(sx, sy);

  // CAD で言う「縮尺 1/N」相当：
  // 世界 1mm → 紙面 pdfPerWorldMM mm = 1 / (1/pdfPerWorldMM)
  const worldScaleDenom = Math.round(1 / pdfPerWorldMM);

  return {
    pageW, pageH,
    drawX, drawY, drawW, drawH,
    worldMinX: (b.minX + b.maxX) / 2 - drawW / 2 / pdfPerWorldMM,
    worldMinY: (b.minY + b.maxY) / 2 - drawH / 2 / pdfPerWorldMM,
    pdfPerWorldMM,
    worldScaleDenom,
  };
}

// 世界 mm → 紙面 mm
function project(p: Point, L: Layout) {
  return {
    x: L.drawX + (p.x - L.worldMinX) * L.pdfPerWorldMM,
    // 世界座標 +Y が上 → PDF は +Y が下なので反転
    y: L.drawY + L.drawH - (p.y - L.worldMinY) * L.pdfPerWorldMM,
  };
}

function setStroke(doc: jsPDF, hexOrTriplet: [number, number, number], lineWidthMM: number) {
  doc.setDrawColor(hexOrTriplet[0], hexOrTriplet[1], hexOrTriplet[2]);
  doc.setLineWidth(lineWidthMM);
}

function setFillRGBA(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function drawShape(doc: jsPDF, s: Shape, L: Layout) {
  switch (s.type) {
    case 'site': {
      if (s.points.length < 2) return;
      const pts = s.points.map(p => project(p, L));
      // 薄い塗り
      setFillRGBA(doc, [255, 244, 200]);
      doc.setLineDashPattern([2, 1], 0);
      setStroke(doc, [160, 96, 0], 0.4);
      doc.lines(
        pts.slice(1).map((p, i) => [p.x - pts[i].x, p.y - pts[i].y]),
        pts[0].x, pts[0].y, [1, 1], 'FD', true,
      );
      doc.setLineDashPattern([], 0);
      break;
    }
    case 'road': {
      if (s.centerLine.length < 2) return;
      const a = s.centerLine[0], b = s.centerLine[1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const half = s.width / 2;
      const corners = [
        project({ x: a.x + nx * half, y: a.y + ny * half }, L),
        project({ x: b.x + nx * half, y: b.y + ny * half }, L),
        project({ x: b.x - nx * half, y: b.y - ny * half }, L),
        project({ x: a.x - nx * half, y: a.y - ny * half }, L),
      ];
      setFillRGBA(doc, [231, 233, 236]);
      setStroke(doc, [136, 136, 136], 0.3);
      doc.lines(
        corners.slice(1).map((p, i) => [p.x - corners[i].x, p.y - corners[i].y]),
        corners[0].x, corners[0].y, [1, 1], 'FD', true,
      );
      // 中心線（破線）
      const cA = project(a, L), cB = project(b, L);
      doc.setLineDashPattern([2, 1.5], 0);
      doc.line(cA.x, cA.y, cB.x, cB.y);
      doc.setLineDashPattern([], 0);
      break;
    }
    case 'building': {
      // 回転考慮の 4 隅 (CAD mm) → 紙面 mm へ投影
      const corners = buildingCorners(s).map(p => project(p, L));
      setFillRGBA(doc, [230, 240, 252]);
      setStroke(doc, [31, 78, 135], 0.5);
      doc.lines(
        corners.slice(1).map((p, i) => [p.x - corners[i].x, p.y - corners[i].y]),
        corners[0].x, corners[0].y, [1, 1], 'FD', true,
      );
      // 対角線（回転後の対角を結ぶ）
      doc.line(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
      doc.line(corners[1].x, corners[1].y, corners[3].x, corners[3].y);
      // 名称（建物中心 = 回転中心）
      if (s.name) {
        const c = project(buildingCenter(s), L);
        doc.setTextColor(31, 78, 135);
        doc.setFontSize(8);
        doc.text(s.name, c.x, c.y, { align: 'center', baseline: 'middle' });
      }
      break;
    }
    case 'dimension': {
      const g = computeDimensionGeometry(s.start, s.end, s.offset);
      const pStart = project(g.start, L);
      const pEnd   = project(g.end, L);
      const pOS    = project(g.offStart, L);
      const pOE    = project(g.offEnd, L);
      const pMid   = project(g.mid, L);
      setStroke(doc, [60, 60, 60], 0.18);
      doc.line(pStart.x, pStart.y, pOS.x, pOS.y);
      doc.line(pEnd.x,   pEnd.y,   pOE.x, pOE.y);
      doc.line(pOS.x,    pOS.y,    pOE.x, pOE.y);
      // 端点丸
      setFillRGBA(doc, [60, 60, 60]);
      doc.circle(pOS.x, pOS.y, 0.4, 'F');
      doc.circle(pOE.x, pOE.y, 0.4, 'F');
      // テキスト
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(7);
      const text = s.text ?? formatDimensionText(s.start, s.end);
      // jsPDF の text 回転は -angle が時計回り
      doc.text(text, pMid.x, pMid.y - 1, { align: 'center', angle: g.angleDeg });
      break;
    }
    case 'compass': {
      const c = project(s.center, L);
      const r = s.radius * L.pdfPerWorldMM;
      setStroke(doc, [30, 30, 30], 0.3);
      setFillRGBA(doc, [255, 255, 255]);
      doc.circle(c.x, c.y, r, 'FD');
      // ひし形針（北向き）
      setFillRGBA(doc, [30, 30, 30]);
      doc.lines([
        [r * 0.18, r * 1.0],
        [-r * 0.18, r * 0.45],
        [-r * 0.18, -r * 0.45],
        [r * 0.18, -r * 1.0],
      ], c.x, c.y - r, [1, 1], 'F', true);
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(8);
      doc.text('N', c.x, c.y - r - 1, { align: 'center' });
      break;
    }
  }
}

function drawTitleBlock(doc: jsPDF, drawing: Drawing, L: Layout) {
  const x = MARGIN_MM;
  const y = L.pageH - MARGIN_MM - TITLEBLOCK_H;
  const w = L.pageW - MARGIN_MM * 2;
  const h = TITLEBLOCK_H;

  setStroke(doc, [40, 40, 40], 0.4);
  doc.rect(x, y, w, h);

  // 内部分割
  doc.line(x + w * 0.6, y, x + w * 0.6, y + h);
  doc.line(x, y + h / 2, x + w * 0.6, y + h / 2);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.text('図面名', x + 2, y + 5);
  doc.setFontSize(13);
  doc.text(drawing.name, x + 2, y + 12);

  doc.setFontSize(9);
  doc.text(`縮尺: 1 / ${L.worldScaleDenom}`,    x + 2,            y + h / 2 + 6);
  doc.text(`単位: mm`,                            x + 2 + w * 0.20, y + h / 2 + 6);
  doc.text(`図形数: ${drawing.shapes.length}`,    x + 2 + w * 0.40, y + h / 2 + 6);

  // 集計
  const site = drawing.shapes.find(s => s.type === 'site');
  const building = drawing.shapes.find(s => s.type === 'building');
  let siteM2 = 0, buildM2 = 0;
  if (site && site.type === 'site') siteM2 = mm2ToM2(polygonArea(site.points));
  if (building && building.type === 'building') buildM2 = (building.width * building.depth) / 1_000_000;

  doc.setFontSize(11);
  doc.text('図面情報', x + w * 0.6 + 2, y + 5);
  doc.setFontSize(9);
  doc.text(`敷地面積: ${siteM2.toFixed(2)} m²`,        x + w * 0.6 + 2, y + 12);
  doc.text(`建築面積: ${buildM2.toFixed(2)} m²`,       x + w * 0.6 + 2, y + 18);
  if (siteM2 > 0) {
    doc.text(`建ぺい率(暫定): ${(buildM2/siteM2*100).toFixed(1)} %`, x + w * 0.6 + 2, y + 24);
  }
  doc.text(`出力日時: ${new Date().toLocaleString('ja-JP')}`,
    x + w * 0.6 + 2, y + h - 2);
}

export function downloadPDF(drawing: Drawing, opts: PdfExportOptions = {}, filename?: string) {
  const orientation = opts.orientation ?? 'landscape';
  const paper = (opts.paper ?? 'A3').toLowerCase() as 'a4' | 'a3';
  const doc = new jsPDF({ orientation, unit: 'mm', format: paper });
  const L = makeLayout(drawing, { ...opts, orientation, paper: paper.toUpperCase() as 'A3' | 'A4' });

  // 描画枠
  setStroke(doc, [180, 180, 180], 0.2);
  doc.rect(L.drawX, L.drawY, L.drawW, L.drawH);

  // 図形
  for (const s of drawing.shapes) drawShape(doc, s, L);
  if (opts.includeAutoDimensions) {
    const auto = generateAutoDimensions(drawing);
    for (const s of auto) drawShape(doc, s, L);
  }

  // 縮尺バー（左下）
  setStroke(doc, [30, 30, 30], 0.4);
  const barX = L.drawX + 4;
  const barY = L.drawY + L.drawH - 4;
  const barLen = 5000 * L.pdfPerWorldMM;
  doc.line(barX, barY, barX + barLen, barY);
  doc.line(barX, barY - 1.2, barX, barY + 1.2);
  doc.line(barX + barLen, barY - 1.2, barX + barLen, barY + 1.2);
  doc.setFontSize(7);
  doc.setTextColor(30, 30, 30);
  doc.text('5 m', barX + barLen / 2, barY - 1.5, { align: 'center' });

  drawTitleBlock(doc, drawing, L);
  doc.save(filename ?? `${drawing.name || 'drawing'}.pdf`);
}
