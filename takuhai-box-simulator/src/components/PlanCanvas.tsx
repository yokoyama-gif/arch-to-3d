import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import { objectColors, judgmentColors } from '../data/presets';
import { getOperationSpaceRects, getDoorSwingRects, runJudgments } from '../utils/judgment';
import { PlacedObject } from '../types';

const PIXELS_PER_MM = 0.25; // 1mm = 0.25px at zoom=1 (so 4000mm = 1000px)

export const PlanCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const {
    canvas,
    setCanvas,
    currentTool,
    selectedObjectId,
    setSelectedObject,
    placingPreset,
    setPlacingPreset,
    placingEquipment,
    setPlacingEquipment,
    setTool,
    addObject,
    updateObject,
    deleteObject,
    setJudgments,
  } = useStore();

  const plan = useStore((s) => s.activePlan());

  const [dragging, setDragging] = useState<{ objectId: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const snapToGrid = useCallback(
    (val: number) => {
      if (!canvas.snapToGrid) return val;
      return Math.round(val / canvas.gridSize) * canvas.gridSize;
    },
    [canvas.snapToGrid, canvas.gridSize]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left - canvas.panX) / (PIXELS_PER_MM * canvas.zoom),
        y: (sy - rect.top - canvas.panY) / (PIXELS_PER_MM * canvas.zoom),
      };
    },
    [canvas.panX, canvas.panY, canvas.zoom]
  );

  const getObjectRect = (obj: PlacedObject) => {
    const isRotated = obj.rotation === 90 || obj.rotation === 270;
    return {
      x: obj.x,
      y: obj.y,
      width: isRotated ? obj.depth : obj.width,
      height: isRotated ? obj.width : obj.depth,
    };
  };

  // Run judgments whenever objects change
  useEffect(() => {
    const results = runJudgments(plan.room, plan.objects, plan.settings);
    setJudgments(results);
  }, [plan.room, plan.objects, plan.settings, setJudgments]);

  // Draw canvas
  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    const container = containerRef.current;
    if (!cvs || !container) return;

    cvs.width = container.clientWidth;
    cvs.height = container.clientHeight;
    const ctx = cvs.getContext('2d')!;
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    ctx.save();
    ctx.translate(canvas.panX, canvas.panY);
    ctx.scale(PIXELS_PER_MM * canvas.zoom, PIXELS_PER_MM * canvas.zoom);

    const room = plan.room;

    // Grid
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1 / (PIXELS_PER_MM * canvas.zoom);
    for (let x = 0; x <= room.width; x += canvas.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, room.depth);
      ctx.stroke();
    }
    for (let y = 0; y <= room.depth; y += canvas.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(room.width, y);
      ctx.stroke();
    }

    // Room outline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4 / (PIXELS_PER_MM * canvas.zoom);
    ctx.strokeRect(0, 0, room.width, room.depth);

    // Room dimensions
    if (canvas.showDimensions) {
      ctx.fillStyle = '#666';
      ctx.font = `${14 / (PIXELS_PER_MM * canvas.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${room.width}mm`, room.width / 2, -20 / (PIXELS_PER_MM * canvas.zoom));
      ctx.save();
      ctx.translate(-20 / (PIXELS_PER_MM * canvas.zoom), room.depth / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${room.depth}mm`, 0, 0);
      ctx.restore();
    }

    // Door swing areas
    if (canvas.showDoorSwing) {
      const swings = getDoorSwingRects(plan.objects);
      for (const { rect } of swings) {
        ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.4)';
        ctx.lineWidth = 1 / (PIXELS_PER_MM * canvas.zoom);
        ctx.setLineDash([8, 4]);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.setLineDash([]);
      }
    }

    // Operation spaces
    if (canvas.showOperationSpace) {
      const opSpaces = getOperationSpaceRects(plan.objects);
      for (const { rect } of opSpaces) {
        ctx.fillStyle = 'rgba(74, 144, 217, 0.08)';
        ctx.strokeStyle = 'rgba(74, 144, 217, 0.3)';
        ctx.lineWidth = 1 / (PIXELS_PER_MM * canvas.zoom);
        ctx.setLineDash([6, 3]);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.setLineDash([]);
      }
    }

    // Judgment areas
    if (canvas.showJudgments) {
      for (const j of plan.judgments) {
        if (j.area) {
          const color = j.level === 'ng' ? 'rgba(244, 67, 54, 0.15)' : 'rgba(255, 193, 7, 0.15)';
          ctx.fillStyle = color;
          ctx.fillRect(j.area.x, j.area.y, j.area.width, j.area.height);
        }
      }
    }

    // Objects
    for (const obj of plan.objects) {
      const r = getObjectRect(obj);
      const color = obj.color || objectColors[obj.type] || '#999';
      const isSelected = obj.id === selectedObjectId;
      const hasNg = plan.judgments.some((j) => j.objectId === obj.id && j.level === 'ng');
      const hasWarn = plan.judgments.some((j) => j.objectId === obj.id && j.level === 'warning');

      // Fill
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.globalAlpha = 1;

      // Border
      if (isSelected) {
        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 4 / (PIXELS_PER_MM * canvas.zoom);
        ctx.setLineDash([6, 3]);
      } else if (hasNg) {
        ctx.strokeStyle = judgmentColors.ng;
        ctx.lineWidth = 3 / (PIXELS_PER_MM * canvas.zoom);
        ctx.setLineDash([]);
      } else if (hasWarn) {
        ctx.strokeStyle = judgmentColors.warning;
        ctx.lineWidth = 3 / (PIXELS_PER_MM * canvas.zoom);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5 / (PIXELS_PER_MM * canvas.zoom);
        ctx.setLineDash([]);
      }
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${11 / (PIXELS_PER_MM * canvas.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = obj.name.length > 6 ? obj.name.slice(0, 6) + '…' : obj.name;
      ctx.fillText(label, r.x + r.width / 2, r.y + r.height / 2);

      // Dimensions
      if (canvas.showDimensions && isSelected) {
        ctx.fillStyle = '#333';
        ctx.font = `${10 / (PIXELS_PER_MM * canvas.zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `${r.width}×${r.height}`,
          r.x + r.width / 2,
          r.y + r.height + 16 / (PIXELS_PER_MM * canvas.zoom)
        );
      }

      // Front direction indicator (delivery boxes)
      if (obj.type === 'delivery_box') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / (PIXELS_PER_MM * canvas.zoom);
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const arrowLen = Math.min(r.width, r.height) * 0.3;
        let ax = cx, ay = cy;
        switch (obj.rotation) {
          case 0:   ay = r.y + r.height - 10; ax = cx; break;
          case 90:  ax = r.x + 10; ay = cy; break;
          case 180: ay = r.y + 10; ax = cx; break;
          case 270: ax = r.x + r.width - 10; ay = cy; break;
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ax, ay);
        ctx.stroke();
      }
    }

    // Placing preview
    if (mousePos && (placingPreset || placingEquipment)) {
      const w = placingPreset?.width || placingEquipment?.width || 400;
      const d = placingPreset?.depth || placingEquipment?.depth || 400;
      const sx = snapToGrid(mousePos.x - w / 2);
      const sy = snapToGrid(mousePos.y - d / 2);
      ctx.fillStyle = 'rgba(74, 144, 217, 0.3)';
      ctx.strokeStyle = '#4A90D9';
      ctx.lineWidth = 2 / (PIXELS_PER_MM * canvas.zoom);
      ctx.setLineDash([4, 4]);
      ctx.fillRect(sx, sy, w, d);
      ctx.strokeRect(sx, sy, w, d);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [canvas, plan, selectedObjectId, mousePos, placingPreset, placingEquipment, snapToGrid]);

  useEffect(() => {
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY);

    // Placing mode
    if (currentTool === 'place' && (placingPreset || placingEquipment)) {
      const w = placingPreset?.width || placingEquipment?.width || 400;
      const d = placingPreset?.depth || placingEquipment?.depth || 400;
      const sx = snapToGrid(world.x - w / 2);
      const sy = snapToGrid(world.y - d / 2);

      if (placingPreset) {
        addObject({
          type: 'delivery_box',
          name: placingPreset.name,
          x: sx,
          y: sy,
          width: placingPreset.width,
          depth: placingPreset.depth,
          height: placingPreset.height,
          rotation: 0,
          presetId: placingPreset.id,
          frontSpace: placingPreset.frontSpace,
          maintenanceSpace: placingPreset.maintenanceSpace,
          mountType: placingPreset.mountType,
        });
      } else if (placingEquipment) {
        addObject({
          type: placingEquipment.type as any,
          name: placingEquipment.name,
          x: sx,
          y: sy,
          width: placingEquipment.width,
          depth: placingEquipment.depth,
          height: placingEquipment.height,
          rotation: 0,
          doorType: placingEquipment.doorType as any,
          doorSwing: (placingEquipment.doorSwing as any) || 'right',
          doorWidth: placingEquipment.doorWidth,
        });
      }

      // Keep placing mode for more items (click to place multiple)
      return;
    }

    // Pan mode
    if (currentTool === 'pan' || e.button === 1) {
      setPanning({ startX: e.clientX, startY: e.clientY, panX: canvas.panX, panY: canvas.panY });
      return;
    }

    // Select mode
    if (currentTool === 'select') {
      // Find clicked object (reverse order for top-most)
      for (let i = plan.objects.length - 1; i >= 0; i--) {
        const obj = plan.objects[i];
        const r = getObjectRect(obj);
        if (world.x >= r.x && world.x <= r.x + r.width && world.y >= r.y && world.y <= r.y + r.height) {
          setSelectedObject(obj.id);
          setDragging({ objectId: obj.id, offsetX: world.x - obj.x, offsetY: world.y - obj.y });
          return;
        }
      }
      setSelectedObject(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY);
    setMousePos(world);

    if (panning) {
      setCanvas({
        panX: panning.panX + (e.clientX - panning.startX),
        panY: panning.panY + (e.clientY - panning.startY),
      });
      return;
    }

    if (dragging) {
      const nx = snapToGrid(world.x - dragging.offsetX);
      const ny = snapToGrid(world.y - dragging.offsetY);
      updateObject(dragging.objectId, { x: nx, y: ny });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setPanning(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, canvas.zoom * delta));
    setCanvas({ zoom: newZoom });
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId) {
          deleteObject(selectedObjectId);
        }
      }
      if (e.key === 'Escape') {
        setSelectedObject(null);
        setPlacingPreset(null);
        setPlacingEquipment(null);
        setTool('select');
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selectedObjectId) {
          const obj = plan.objects.find((o) => o.id === selectedObjectId);
          if (obj) {
            updateObject(selectedObjectId, { rotation: ((obj.rotation + 90) % 360) as any });
          }
        }
      }
      if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        if (selectedObjectId) {
          const store = useStore.getState();
          store.duplicateObject(selectedObjectId);
        }
      }
    },
    [selectedObjectId, deleteObject, setSelectedObject, setPlacingPreset, setPlacingEquipment, setTool, plan.objects, updateObject]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Initial pan to center the room
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const roomPxW = plan.room.width * PIXELS_PER_MM * canvas.zoom;
      const roomPxH = plan.room.depth * PIXELS_PER_MM * canvas.zoom;
      setCanvas({
        panX: (container.clientWidth - roomPxW) / 2,
        panY: (container.clientHeight - roomPxH) / 2,
      });
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: '#fafafa',
        cursor:
          currentTool === 'pan'
            ? 'grab'
            : currentTool === 'place'
            ? 'crosshair'
            : dragging
            ? 'grabbing'
            : 'default',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};

// Export for screenshot/png export
export function getCanvasDataUrl(): string | null {
  const canvas = document.querySelector('canvas');
  return canvas?.toDataURL('image/png') || null;
}
