import React from 'react';
import type { BuildingShape, Drawing, Shape, ToolId } from '../types/drawing';
import { mm2ToM2, mm2ToTsubo, polygonArea } from '../utils/geometry';
import { TOOL_DEFINITIONS } from './ToolBar';

// 建物の編集可能フィールドのみを Pick したパッチ型
export type BuildingPatch = Partial<Pick<BuildingShape, 'name' | 'width' | 'depth' | 'rotation'>>;

interface Props {
  drawing: Drawing;
  tool: ToolId;
  selectedId: string | null;
  onUpdateBuilding?: (id: string, patch: BuildingPatch) => void;
}

const SHAPE_LABEL: Record<Shape['type'], string> = {
  site: '敷地',
  road: '道路',
  building: '建物',
  dimension: '寸法線',
  compass: '方位記号',
};

// 数値入力（変更時にコールバック）。
// 空文字や NaN 入力時は呼ばずに UI 表示だけ更新する。
const NumberInput: React.FC<{
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onCommit: (v: number) => void;
}> = ({ value, step = 1, min, max, onCommit }) => {
  const [local, setLocal] = React.useState<string>(String(value));
  // 親 value が変わったら同期（ドラッグで origin が動く等）
  React.useEffect(() => { setLocal(String(value)); }, [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) { setLocal(String(value)); return; }
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    onCommit(v);
  };

  return (
    <input
      type="number"
      className="prop-input"
      value={local}
      step={step}
      min={min}
      max={max}
      onChange={e => setLocal(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setLocal(String(value)); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
};

const TextInput: React.FC<{ value: string; onCommit: (v: string) => void }> = ({ value, onCommit }) => {
  const [local, setLocal] = React.useState<string>(value);
  React.useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="text"
      className="prop-input"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setLocal(value); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
};

// 建物編集 UI
const BuildingEditor: React.FC<{
  shape: BuildingShape;
  onChange: (patch: BuildingPatch) => void;
}> = ({ shape, onChange }) => {
  const rot = shape.rotation ?? 0;
  return (
    <>
      <div className="prop-row prop-edit-row">
        <span className="prop-key">名称</span>
        <span className="prop-val">
          <TextInput value={shape.name ?? ''} onCommit={v => onChange({ name: v })} />
        </span>
      </div>
      <div className="prop-row">
        <span className="prop-key">基点</span>
        <span className="prop-val">X={Math.round(shape.origin.x)}, Y={Math.round(shape.origin.y)} mm</span>
      </div>
      <div className="prop-row prop-edit-row">
        <span className="prop-key">幅 (mm)</span>
        <span className="prop-val">
          <NumberInput value={shape.width} step={100} min={100}
            onCommit={v => onChange({ width: v })} />
        </span>
      </div>
      <div className="prop-row prop-edit-row">
        <span className="prop-key">奥行 (mm)</span>
        <span className="prop-val">
          <NumberInput value={shape.depth} step={100} min={100}
            onCommit={v => onChange({ depth: v })} />
        </span>
      </div>
      <div className="prop-row">
        <span className="prop-key">建築面積</span>
        <span className="prop-val">{(shape.width * shape.depth / 1_000_000).toFixed(2)} m²</span>
      </div>
      <div className="prop-row prop-edit-row">
        <span className="prop-key">回転 (°)</span>
        <span className="prop-val">
          <NumberInput value={rot} step={5}
            onCommit={v => onChange({ rotation: v })} />
        </span>
      </div>
      <div className="panel-note">
        ※ 回転は建物中心まわりの CCW 角度（°）。0/未指定で未回転。
      </div>
    </>
  );
};

function SelectedShapeProps({ shape, onUpdateBuilding }: {
  shape: Shape;
  onUpdateBuilding?: (id: string, patch: BuildingPatch) => void;
}) {
  // 共通: 種類 + ID
  const head = (
    <>
      <div className="prop-row"><span className="prop-key">種類</span><span className="prop-val">{SHAPE_LABEL[shape.type]}</span></div>
      <div className="prop-row"><span className="prop-key">ID</span><span className="prop-val">{shape.id}</span></div>
    </>
  );

  if (shape.type === 'building' && onUpdateBuilding) {
    return (
      <>
        {head}
        <BuildingEditor shape={shape} onChange={p => onUpdateBuilding(shape.id, p)} />
      </>
    );
  }

  // それ以外（および onUpdateBuilding なしの建物）は読み取り専用
  const rows: { k: string; v: string }[] = [];
  switch (shape.type) {
    case 'site': {
      const a = polygonArea(shape.points);
      rows.push({ k: '頂点数', v: `${shape.points.length}` });
      rows.push({ k: '面積', v: `${mm2ToM2(a).toFixed(2)} m² (${mm2ToTsubo(a).toFixed(2)} 坪)` });
      break;
    }
    case 'road':
      rows.push({ k: '幅員', v: `${shape.width} mm` });
      rows.push({ k: '節点数', v: `${shape.centerLine.length}` });
      break;
    case 'building':
      rows.push({ k: '名称', v: shape.name ?? '-' });
      rows.push({ k: '基点', v: `X=${shape.origin.x}, Y=${shape.origin.y} mm` });
      rows.push({ k: '寸法', v: `${shape.width} × ${shape.depth} mm` });
      rows.push({ k: '建築面積', v: `${(shape.width * shape.depth / 1_000_000).toFixed(2)} m²` });
      rows.push({ k: '回転', v: `${shape.rotation ?? 0}°` });
      break;
    case 'dimension':
      rows.push({ k: '始点', v: `${Math.round(shape.start.x)}, ${Math.round(shape.start.y)}` });
      rows.push({ k: '終点', v: `${Math.round(shape.end.x)}, ${Math.round(shape.end.y)}` });
      rows.push({ k: '長さ', v: `${Math.round(Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y))} mm` });
      rows.push({ k: 'オフセット', v: `${shape.offset} mm` });
      break;
    case 'compass':
      rows.push({ k: '中心', v: `${shape.center.x}, ${shape.center.y}` });
      rows.push({ k: '半径', v: `${shape.radius} mm` });
      break;
  }
  return (
    <>
      {head}
      {rows.map(r => (
        <div className="prop-row" key={r.k}>
          <span className="prop-key">{r.k}</span>
          <span className="prop-val">{r.v}</span>
        </div>
      ))}
    </>
  );
}

export const PropertyPanel: React.FC<Props> = ({ drawing, tool, selectedId, onUpdateBuilding }) => {
  const toolDef = TOOL_DEFINITIONS.find(t => t.id === tool);
  const selected = drawing.shapes.find(s => s.id === selectedId) ?? null;

  // 集計：全敷地・全建物の合計値
  let siteCount = 0, buildingCount = 0;
  let siteAreaMM2 = 0, buildingAreaMM2 = 0;
  for (const s of drawing.shapes) {
    if (s.type === 'site') {
      siteCount++;
      siteAreaMM2 += polygonArea(s.points);
    } else if (s.type === 'building') {
      buildingCount++;
      buildingAreaMM2 += s.width * s.depth;
    }
  }
  const siteAreaM2     = mm2ToM2(siteAreaMM2);
  const siteAreaTsubo  = mm2ToTsubo(siteAreaMM2);
  const buildingAreaM2 = mm2ToM2(buildingAreaMM2);
  const coverageRatio  = siteAreaM2 > 0 ? (buildingAreaM2 / siteAreaM2) * 100 : 0;

  return (
    <div className="propertypanel">
      <div className="panel-section">
        <div className="panel-title">図面情報</div>
        <div className="prop-row"><span className="prop-key">図面名</span><span className="prop-val">{drawing.name}</span></div>
        <div className="prop-row"><span className="prop-key">縮尺</span><span className="prop-val">1/{drawing.scale}</span></div>
        <div className="prop-row"><span className="prop-key">単位</span><span className="prop-val">{drawing.unit}</span></div>
        <div className="prop-row"><span className="prop-key">図形数</span><span className="prop-val">{drawing.shapes.length}</span></div>
      </div>

      <div className="panel-section">
        <div className="panel-title">選択中の図形</div>
        {selected ? (
          <SelectedShapeProps shape={selected} onUpdateBuilding={onUpdateBuilding} />
        ) : (
          <div className="panel-note">図形が選択されていません。<br/>選択ツールで図形をクリックしてください。</div>
        )}
      </div>

      <div className="panel-section">
        <div className="panel-title">現在のツール</div>
        <div className="prop-row">
          <span className="prop-key">名称</span>
          <span className="prop-val prop-tool-name">{toolDef?.label ?? '-'}</span>
        </div>
        {toolDef?.shortcut && (
          <div className="prop-row">
            <span className="prop-key">ショートカット</span>
            <span className="prop-val">{toolDef.shortcut}</span>
          </div>
        )}
        <div className="prop-guide">{toolDef?.guide ?? ''}</div>
      </div>

      <div className="panel-section">
        <div className="panel-title">敷地情報（参考表示）</div>
        <div className="prop-row"><span className="prop-key">敷地数</span><span className="prop-val">{siteCount}</span></div>
        <div className="prop-row"><span className="prop-key">敷地面積合計</span><span className="prop-val">{siteAreaM2.toFixed(2)} m²</span></div>
        <div className="prop-row"><span className="prop-key">坪換算</span><span className="prop-val">{siteAreaTsubo.toFixed(2)} 坪</span></div>
        <div className="prop-row"><span className="prop-key">建物数</span><span className="prop-val">{buildingCount}</span></div>
        <div className="prop-row"><span className="prop-key">建築面積合計</span><span className="prop-val">{buildingAreaM2.toFixed(2)} m²</span></div>
        <div className="prop-row"><span className="prop-key">建ぺい率(暫定)</span><span className="prop-val">{coverageRatio.toFixed(1)} %</span></div>
        <div className="panel-note">
          ※ 図面内のすべての敷地・建物を合計。建ぺい率は 合計建築面積 ÷ 合計敷地面積 で算出（暫定）。
        </div>
      </div>
    </div>
  );
};
