import React from 'react';
import { TopMenu } from './components/TopMenu';
import { ToolBar } from './components/ToolBar';
import { CadCanvas, type CadCanvasHandle } from './components/CadCanvas';
import { PropertyPanel, type BuildingPatch } from './components/PropertyPanel';
import { StatusBar } from './components/StatusBar';
import { CommandGuide } from './components/CommandGuide';
import { sampleDrawing } from './data/sampleDrawing';
import type { Drawing, InputState, Point, Shape, ToolId } from './types/drawing';
import { makeBuilding, makeCompass, makeDimension, makeRoad, makeSite, moveShape } from './utils/shapeOps';
import { downloadDrawingJSON, pickJSONFile } from './utils/fileIO';
import { downloadPDF } from './utils/pdfExport';
import { downloadDXF } from './utils/dxfExport';
import { materializeAutoDimensions } from './utils/autoDimensions';
import { useHistory } from './utils/useHistory';

const EMPTY_DRAWING: Drawing = {
  id: 'new-' + Date.now().toString(36),
  name: '無題図面',
  scale: 100,
  unit: 'mm',
  shapes: [],
};

export const App: React.FC = () => {
  const [tool, setToolRaw] = React.useState<ToolId>('select');
  const [cursorMM, setCursorMM] = React.useState<Point | null>(null);
  // 図面の状態は履歴付きで管理。setDrawing は履歴に push、replaceDrawing は履歴クリア。
  const {
    value: drawing,
    set: setDrawing,
    replace: replaceDrawing,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize,
    historyIndex,
  } = useHistory<Drawing>(sampleDrawing);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [inputState, setInputState] = React.useState<InputState>({ kind: 'idle' });
  const [statusMsg, setStatusMsg] = React.useState<string>('');
  const [showAutoDims, setShowAutoDims] = React.useState<boolean>(false);

  const canvasRef = React.useRef<CadCanvasHandle>(null);

  const setStatus = React.useCallback((msg: string, ttlMs = 3000) => {
    setStatusMsg(msg);
    const t = setTimeout(() => setStatusMsg(curr => (curr === msg ? '' : curr)), ttlMs);
    return () => clearTimeout(t);
  }, []);

  // ===== ツール切替 =====
  const setTool = React.useCallback((id: ToolId) => {
    setToolRaw(id);
    setSelectedId(null);
    switch (id) {
      case 'siteLine':  setInputState({ kind: 'site-drawing', points: [] }); break;
      case 'building':  setInputState({ kind: 'building-corner1' }); break;
      case 'road':      setInputState({ kind: 'road-point1' }); break;
      case 'dimension': setInputState({ kind: 'dimension-point1' }); break;
      case 'compass':   setInputState({ kind: 'compass-place' }); break;
      default:          setInputState({ kind: 'idle' });
    }
  }, []);

  // ===== 図形操作 =====
  const addShape = React.useCallback((s: Shape) => {
    setDrawing(d => ({ ...d, shapes: [...d.shapes, s] }));
  }, []);
  const removeShape = React.useCallback((id: string) => {
    setDrawing(d => ({ ...d, shapes: d.shapes.filter(s => s.id !== id) }));
    setSelectedId(curr => (curr === id ? null : curr));
  }, []);
  const translateShape = React.useCallback((id: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    setDrawing(d => ({
      ...d,
      shapes: d.shapes.map(s => (s.id === id ? moveShape(s, dx, dy) : s)),
    }));
  }, []);

  // 建物の編集可能フィールドを部分更新。型は Partial で安全に展開。
  const updateBuilding = React.useCallback((id: string, patch: BuildingPatch) => {
    setDrawing(d => ({
      ...d,
      shapes: d.shapes.map(s => {
        if (s.id !== id || s.type !== 'building') return s;
        return { ...s, ...patch };
      }),
    }));
  }, []);

  // ===== コマンド処理 =====
  const handleCanvasClick = React.useCallback((mm: Point) => {
    setInputState(prev => {
      switch (prev.kind) {
        case 'site-drawing': {
          if (prev.points.length >= 3) {
            const first = prev.points[0];
            if (Math.hypot(mm.x - first.x, mm.y - first.y) < 500) {
              addShape(makeSite(prev.points));
              return { kind: 'site-drawing', points: [] };
            }
          }
          return { kind: 'site-drawing', points: [...prev.points, mm] };
        }
        case 'building-corner1': return { kind: 'building-corner2', first: mm };
        case 'building-corner2': {
          if (mm.x !== prev.first.x && mm.y !== prev.first.y) addShape(makeBuilding(prev.first, mm));
          return { kind: 'building-corner1' };
        }
        case 'road-point1': return { kind: 'road-point2', first: mm };
        case 'road-point2': {
          if (mm.x !== prev.first.x || mm.y !== prev.first.y) addShape(makeRoad(prev.first, mm));
          return { kind: 'road-point1' };
        }
        case 'dimension-point1': return { kind: 'dimension-point2', first: mm };
        case 'dimension-point2': {
          if (mm.x !== prev.first.x || mm.y !== prev.first.y) addShape(makeDimension(prev.first, mm));
          return { kind: 'dimension-point1' };
        }
        case 'compass-place': {
          addShape(makeCompass(mm));
          return { kind: 'compass-place' };
        }
        default: return prev;
      }
    });
  }, [addShape]);

  const handleCanvasContextMenu = React.useCallback(() => {
    setInputState(prev => {
      if (prev.kind === 'site-drawing' && prev.points.length >= 3) {
        addShape(makeSite(prev.points));
        return { kind: 'site-drawing', points: [] };
      }
      if (prev.kind === 'building-corner2') return { kind: 'building-corner1' };
      if (prev.kind === 'road-point2')      return { kind: 'road-point1' };
      if (prev.kind === 'dimension-point2') return { kind: 'dimension-point1' };
      if (prev.kind === 'site-drawing')     return { kind: 'site-drawing', points: [] };
      return prev;
    });
  }, [addShape]);

  const handleShapeClick = React.useCallback((id: string) => setSelectedId(id || null), []);
  const handleShapeDragEnd = React.useCallback((id: string, dx: number, dy: number) => translateShape(id, dx, dy), [translateShape]);
  const handleShapeDelete  = React.useCallback((id: string) => removeShape(id), [removeShape]);

  // ===== ファイル I/O =====
  const handleNew = React.useCallback(() => {
    if (!confirm('現在の図面を破棄して新規作成しますか？\n（操作履歴もクリアされます）')) return;
    replaceDrawing({ ...EMPTY_DRAWING, id: 'new-' + Date.now().toString(36) });
    setSelectedId(null);
    setInputState({ kind: 'idle' });
    setToolRaw('select');
    setStatus('新規図面を作成しました');
    setTimeout(() => canvasRef.current?.fitAll(), 50);
  }, [replaceDrawing, setStatus]);

  const handleSave = React.useCallback(() => {
    downloadDrawingJSON(drawing);
    setStatus(`保存: ${drawing.name}.json`);
  }, [drawing, setStatus]);

  const handleSaveAs = React.useCallback(() => {
    const name = prompt('図面名を入力してください', drawing.name) ?? drawing.name;
    const next = { ...drawing, name };
    setDrawing(next);
    downloadDrawingJSON(next, `${name}.json`);
    setStatus(`保存: ${name}.json`);
  }, [drawing, setStatus]);

  const handleOpen = React.useCallback(async () => {
    try {
      const loaded = await pickJSONFile();
      replaceDrawing(loaded);
      setSelectedId(null);
      setInputState({ kind: 'idle' });
      setToolRaw('select');
      setStatus(`読込: ${loaded.name} (図形 ${loaded.shapes.length})`);
      setTimeout(() => canvasRef.current?.fitAll(), 50);
    } catch (e) {
      alert('読み込み失敗: ' + (e as Error).message);
    }
  }, [replaceDrawing, setStatus]);

  // ===== PDF / DXF =====
  const handleExportPDF = React.useCallback(() => {
    try {
      downloadPDF(drawing, { includeAutoDimensions: showAutoDims, paper: 'A3', orientation: 'landscape' });
      setStatus(`PDF 出力: ${drawing.name}.pdf`);
    } catch (e) { alert('PDF 出力失敗: ' + (e as Error).message); }
  }, [drawing, showAutoDims, setStatus]);

  const handleExportDXF = React.useCallback(() => {
    try {
      downloadDXF(drawing, { includeAutoDimensions: showAutoDims });
      setStatus(`DXF 出力: ${drawing.name}.dxf`);
    } catch (e) { alert('DXF 出力失敗: ' + (e as Error).message); }
  }, [drawing, showAutoDims, setStatus]);

  // 自動寸法を実体化（drawing.shapes に永続化）
  const handleMaterializeAutoDims = React.useCallback(() => {
    setDrawing(d => ({ ...d, shapes: materializeAutoDimensions(d) }));
    setStatus('自動寸法を実体化しました（編集・移動可能になりました）');
  }, [setStatus]);

  // ===== Undo / Redo =====
  // 履歴移動後、もし選択中の id が消えていたらクリアする。
  const handleUndo = React.useCallback(() => {
    undo();
    setStatus('元に戻す');
  }, [undo, setStatus]);
  const handleRedo = React.useCallback(() => {
    redo();
    setStatus('やり直し');
  }, [redo, setStatus]);

  // 履歴遷移後の整合: drawing.shapes に存在しない selectedId をクリア
  React.useEffect(() => {
    if (selectedId && !drawing.shapes.some(s => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [drawing.shapes, selectedId]);

  // ===== メニューアクション =====
  const handleMenu = React.useCallback((action: string) => {
    switch (action) {
      case 'file.new':    handleNew(); break;
      case 'file.open':   handleOpen(); break;
      case 'file.save':   handleSave(); break;
      case 'file.saveAs': handleSaveAs(); break;
      case 'file.exportPDF': handleExportPDF(); break;
      case 'file.exportDXF': handleExportDXF(); break;
      case 'edit.undo':   handleUndo(); break;
      case 'edit.redo':   handleRedo(); break;
      case 'edit.deleteSelected':
        if (selectedId) removeShape(selectedId);
        break;
      case 'view.fitAll':  canvasRef.current?.fitAll(); break;
      case 'view.zoomIn':  canvasRef.current?.zoomIn(); break;
      case 'view.zoomOut': canvasRef.current?.zoomOut(); break;
      case 'view.reset':   canvasRef.current?.resetView(); break;
      case 'view.toggleAutoDims':
        setShowAutoDims(v => { setStatus(v ? '自動寸法 OFF' : '自動寸法 ON'); return !v; });
        break;
      case 'tool.siteLine':  setTool('siteLine'); break;
      case 'tool.road':      setTool('road'); break;
      case 'tool.building':  setTool('building'); break;
      case 'tool.dimension': setTool('dimension'); break;
      case 'tool.compass':   setTool('compass'); break;
      case 'calc.materializeAutoDims': handleMaterializeAutoDims(); break;
      case 'help.about':
        alert('配置図CAD / Undo・Redo・自動寸法・PDF・DXF 対応');
        break;
    }
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleExportPDF, handleExportDXF,
      handleUndo, handleRedo,
      handleMaterializeAutoDims, removeShape, selectedId, setTool, setStatus]);

  // ===== ショートカットキー =====
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 's') { e.preventDefault(); e.shiftKey ? handleSaveAs() : handleSave(); return; }
        if (k === 'o') { e.preventDefault(); handleOpen(); return; }
        if (k === 'n') { e.preventDefault(); handleNew(); return; }
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo(); else handleUndo();
          return;
        }
        if (k === 'y') { e.preventDefault(); handleRedo(); return; }
        return;
      }
      const map: Record<string, ToolId> = {
        s: 'select', l: 'siteLine', r: 'road',
        b: 'building', d: 'dimension', n: 'compass',
      };
      if (e.key === 'Escape') {
        setTool('select');
      } else if (e.key === 'Enter') {
        setInputState(prev => {
          if (prev.kind === 'site-drawing' && prev.points.length >= 3) {
            addShape(makeSite(prev.points));
            return { kind: 'site-drawing', points: [] };
          }
          return prev;
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) removeShape(selectedId);
        else setTool('delete');
      } else if (k === 'f' && !e.ctrlKey) {
        canvasRef.current?.fitAll();
      } else if (k === '+' || e.key === '=') {
        canvasRef.current?.zoomIn();
      } else if (k === '-') {
        canvasRef.current?.zoomOut();
      } else if (k === '0') {
        canvasRef.current?.resetView();
      } else if (k === 't') {
        setShowAutoDims(v => !v);
      } else if (map[k]) {
        setTool(map[k]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTool, addShape, removeShape, selectedId, handleSave, handleSaveAs, handleOpen, handleNew, handleUndo, handleRedo]);

  return (
    <div className="app">
      <TopMenu onAction={handleMenu} canUndo={canUndo} canRedo={canRedo} />
      <CommandGuide tool={tool} inputState={inputState} cursorMM={cursorMM} statusMsg={statusMsg} />
      <div className="app-body">
        <ToolBar current={tool} onChange={setTool} />
        <main className="app-main">
          <CadCanvas
            ref={canvasRef}
            drawing={drawing}
            tool={tool}
            inputState={inputState}
            selectedId={selectedId}
            showAutoDimensions={showAutoDims}
            onCursorChange={setCursorMM}
            onCanvasClick={handleCanvasClick}
            onCanvasContextMenu={handleCanvasContextMenu}
            onShapeClick={handleShapeClick}
            onShapeDragEnd={handleShapeDragEnd}
            onShapeDelete={handleShapeDelete}
          />
        </main>
        <PropertyPanel
          drawing={drawing}
          tool={tool}
          selectedId={selectedId}
          onUpdateBuilding={updateBuilding}
        />
      </div>
      <StatusBar
        tool={tool}
        cursorMM={cursorMM}
        scaleDenominator={drawing.scale}
        shapeCount={drawing.shapes.length}
        message={statusMsg}
        historyIndex={historyIndex}
        historySize={historySize}
      />
    </div>
  );
};
