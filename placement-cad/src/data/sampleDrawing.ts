import type { Drawing } from '../types/drawing';

// サンプル配置図 (mm 単位)
// 敷地: 約 20m x 15m / 道路: 北側道路 幅員4m / 建物: 10m x 7m
export const sampleDrawing: Drawing = {
  id: 'sample-001',
  name: '配置図サンプル_共同住宅A',
  scale: 100,
  unit: 'mm',
  shapes: [
    {
      id: 'site-1',
      type: 'site',
      points: [
        { x: 0,     y: 0 },
        { x: 20000, y: 0 },
        { x: 20000, y: 15000 },
        { x: 0,     y: 15000 },
      ],
    },
    {
      id: 'road-1',
      type: 'road',
      // 北側道路（敷地の上側、Y=17000を中心線に幅4m）
      centerLine: [
        { x: -2000, y: 17000 },
        { x: 22000, y: 17000 },
      ],
      width: 4000,
    },
    {
      id: 'building-1',
      type: 'building',
      origin: { x: 4000, y: 3000 },
      width: 10000,
      depth: 7000,
      rotation: 0,
      name: '計画建物（共同住宅）',
    },
    // 寸法線：敷地の南辺（横方向）
    {
      id: 'dim-1',
      type: 'dimension',
      start: { x: 0, y: 0 },
      end:   { x: 20000, y: 0 },
      offset: -1500,
    },
    // 寸法線：敷地の西辺（縦方向）
    {
      id: 'dim-2',
      type: 'dimension',
      start: { x: 0, y: 0 },
      end:   { x: 0, y: 15000 },
      offset: -1500,
    },
    // 方位記号（敷地右上）
    {
      id: 'compass-1',
      type: 'compass',
      center: { x: 22500, y: 13500 },
      radius: 1200,
      northAngle: 90,
    },
  ],
};
