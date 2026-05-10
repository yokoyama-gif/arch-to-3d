import type { Drawing, Point, Shape } from '../types/drawing';

// JSON 形式バージョン（将来 schema が変わったら互換変換のキー）
export const FILE_FORMAT = 'placement-cad/1';

export interface DrawingFile {
  format: typeof FILE_FORMAT;
  savedAt: string; // ISO 8601
  drawing: Drawing;
}

// ===== 保存 =====
export function downloadDrawingJSON(drawing: Drawing, filename?: string) {
  const file: DrawingFile = {
    format: FILE_FORMAT,
    savedAt: new Date().toISOString(),
    drawing,
  };
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${drawing.name || 'drawing'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 非同期で revoke（即時 revoke はブラウザによっては DL 失敗）
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ===== 読み込み =====
export class DrawingLoadError extends Error {}

export function parseDrawingJSON(text: string): Drawing {
  let data: unknown;
  try { data = JSON.parse(text); }
  catch (e) { throw new DrawingLoadError('JSON 構文エラー: ' + (e as Error).message); }

  if (typeof data !== 'object' || data === null) {
    throw new DrawingLoadError('ルートがオブジェクトではありません');
  }
  const obj = data as Record<string, unknown>;

  // 上位ラッパ ({ format, drawing }) 形式と素の Drawing 直書きを両対応
  const candidate: unknown =
    typeof obj.format === 'string' && obj.drawing && typeof obj.drawing === 'object'
      ? obj.drawing
      : obj;
  return validateDrawing(candidate);
}

export function validateDrawing(d: unknown): Drawing {
  if (typeof d !== 'object' || d === null) throw new DrawingLoadError('Drawing 型ではありません');
  const o = d as Record<string, unknown>;
  if (typeof o.id !== 'string') throw new DrawingLoadError('drawing.id が文字列ではありません');
  if (typeof o.name !== 'string') throw new DrawingLoadError('drawing.name が文字列ではありません');
  if (typeof o.scale !== 'number') throw new DrawingLoadError('drawing.scale が数値ではありません');
  if (o.unit !== 'mm') throw new DrawingLoadError('drawing.unit は "mm" のみ対応です');
  if (!Array.isArray(o.shapes)) throw new DrawingLoadError('drawing.shapes が配列ではありません');

  // 不正な shape は throw せずに skip し、警告を集める方針 (描画時クラッシュ防止)
  const errors: string[] = [];
  const shapes: Shape[] = [];
  o.shapes.forEach((s, i) => {
    try {
      shapes.push(validateShape(s, i));
    } catch (e) {
      errors.push((e as Error).message);
    }
  });
  if (errors.length > 0) {
    // 開発時のデバッグ用に console へ出すが、読み込みは継続する
    console.warn(`[fileIO] ${errors.length} 件の不正 shape をスキップしました:\n` + errors.join('\n'));
  }

  return {
    id: o.id,
    name: o.name,
    scale: o.scale,
    unit: 'mm',
    shapes,
    meta: (o.meta as Drawing['meta']) ?? undefined,
  };
}

// 数値・文字列・点の安全変換ヘルパ
function toNumber(v: unknown, ctx: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new DrawingLoadError(`${ctx} は有限の数値である必要があります`);
  }
  return v;
}
function toPositiveNumber(v: unknown, ctx: string): number {
  const n = toNumber(v, ctx);
  if (n <= 0) throw new DrawingLoadError(`${ctx} は正の数値である必要があります (got ${n})`);
  return n;
}
function toPoint(v: unknown, ctx: string): Point {
  if (typeof v !== 'object' || v === null) throw new DrawingLoadError(`${ctx} はオブジェクトではありません`);
  const o = v as Record<string, unknown>;
  return { x: toNumber(o.x, `${ctx}.x`), y: toNumber(o.y, `${ctx}.y`) };
}
function toPointArray(v: unknown, ctx: string, minLen = 0): Point[] {
  if (!Array.isArray(v)) throw new DrawingLoadError(`${ctx} は配列ではありません`);
  if (v.length < minLen) throw new DrawingLoadError(`${ctx} は最低 ${minLen} 点必要です (got ${v.length})`);
  return v.map((p, i) => toPoint(p, `${ctx}[${i}]`));
}
function toOptionalString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function toOptionalBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}
function toNumberOrDefault(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

// type 別に必須フィールドを検証し、optional フィールドには安全な default を入れる。
function validateShape(s: unknown, idx: number): Shape {
  if (typeof s !== 'object' || s === null) throw new DrawingLoadError(`shape[${idx}] はオブジェクトではありません`);
  const o = s as Record<string, unknown>;
  if (typeof o.id !== 'string')   throw new DrawingLoadError(`shape[${idx}].id は文字列必須`);
  if (typeof o.type !== 'string') throw new DrawingLoadError(`shape[${idx}].type は文字列必須`);
  const id = o.id;
  const layer = toOptionalString(o.layer);
  const locked = toOptionalBoolean(o.locked);
  const ctx = `shape[${idx}](type=${o.type})`;

  switch (o.type) {
    case 'site': {
      const points = toPointArray(o.points, `${ctx}.points`, 3);
      return { id, type: 'site', points, layer, locked };
    }
    case 'road': {
      const centerLine = toPointArray(o.centerLine, `${ctx}.centerLine`, 2);
      const width = toPositiveNumber(o.width, `${ctx}.width`);
      return { id, type: 'road', centerLine, width, layer, locked };
    }
    case 'building': {
      const origin = toPoint(o.origin, `${ctx}.origin`);
      const width  = toPositiveNumber(o.width,  `${ctx}.width`);
      const depth  = toPositiveNumber(o.depth,  `${ctx}.depth`);
      const rotation = toNumberOrDefault(o.rotation, 0);
      const name = toOptionalString(o.name);
      return { id, type: 'building', origin, width, depth, rotation, name, layer, locked };
    }
    case 'dimension': {
      const start = toPoint(o.start, `${ctx}.start`);
      const end   = toPoint(o.end,   `${ctx}.end`);
      const offset = toNumber(o.offset, `${ctx}.offset`);
      const text = toOptionalString(o.text);
      return { id, type: 'dimension', start, end, offset, text, layer, locked };
    }
    case 'compass': {
      const center = toPoint(o.center, `${ctx}.center`);
      const radius = toPositiveNumber(o.radius, `${ctx}.radius`);
      const northAngle = toNumberOrDefault(o.northAngle, 90);
      return { id, type: 'compass', center, radius, northAngle, layer, locked };
    }
    default:
      throw new DrawingLoadError(`${ctx}: 未知の type "${o.type}"`);
  }
}

// 隠し input[type=file] を作って一発でファイル選択ダイアログを出す
export function pickJSONFile(): Promise<Drawing> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new DrawingLoadError('ファイルが選択されませんでした')); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(parseDrawingJSON(String(reader.result))); }
        catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new DrawingLoadError('ファイル読み込み失敗'));
      reader.readAsText(file, 'utf-8');
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => document.body.removeChild(input), 30000);
  });
}
