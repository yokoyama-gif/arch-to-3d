import type { LayoutTemplate } from './types';

export const layoutTemplates: LayoutTemplate[] = [
  {
    id: 'template-balanced',
    name: 'バランス型オフィス',
    description: '執務、会議、受付を均等に分ける標準テンプレートです。',
    room: {
      name: '標準オフィス',
      width: 14000,
      height: 9000,
      wallThickness: 180,
      doors: [
        {
          id: 'door-entry-1',
          name: 'メイン入口',
          wall: 'bottom',
          offset: 1600,
          width: 1200,
          swing: 'inward',
        },
      ],
    },
    zones: [
      {
        name: '執務ゾーン',
        type: 'work',
        color: '#bfdbfe',
        rect: { x: 600, y: 1400, width: 7600, height: 6200 },
      },
      {
        name: '会議ゾーン',
        type: 'meeting',
        color: '#ddd6fe',
        rect: { x: 8600, y: 1200, width: 4200, height: 2800 },
      },
      {
        name: '受付ゾーン',
        type: 'reception',
        color: '#bbf7d0',
        rect: { x: 8600, y: 4700, width: 4200, height: 2200 },
      },
      {
        name: '共用ゾーン',
        type: 'support',
        color: '#fde68a',
        rect: { x: 8600, y: 7100, width: 4200, height: 1200 },
      },
    ],
    objects: [
      { libraryItemId: 'desk-island-4', x: 1200, y: 1800 },
      { libraryItemId: 'desk-island-4', x: 1200, y: 3800 },
      { libraryItemId: 'desk-free-address', x: 4500, y: 2800 },
      { libraryItemId: 'meeting-6', x: 9200, y: 1700 },
      { libraryItemId: 'reception-counter', x: 9200, y: 5200 },
      { libraryItemId: 'copier', x: 11800, y: 7400 },
    ],
  },
  {
    id: 'template-client-facing',
    name: '来客対応重視',
    description: '受付とラウンジを入口付近にまとめたテンプレートです。',
    room: {
      name: '来客重視オフィス',
      width: 12000,
      height: 8000,
      wallThickness: 180,
      doors: [
        {
          id: 'door-entry-1',
          name: '入口',
          wall: 'bottom',
          offset: 900,
          width: 1100,
          swing: 'inward',
        },
      ],
    },
    zones: [
      {
        name: '受付',
        type: 'reception',
        color: '#bbf7d0',
        rect: { x: 600, y: 4900, width: 3200, height: 2200 },
      },
      {
        name: '来客ラウンジ',
        type: 'lounge',
        color: '#fbcfe8',
        rect: { x: 4200, y: 4900, width: 3000, height: 2200 },
      },
      {
        name: '執務',
        type: 'work',
        color: '#bfdbfe',
        rect: { x: 800, y: 1000, width: 6600, height: 3000 },
      },
      {
        name: '会議',
        type: 'meeting',
        color: '#ddd6fe',
        rect: { x: 7600, y: 1000, width: 3400, height: 6100 },
      },
    ],
    objects: [
      { libraryItemId: 'reception-counter', x: 900, y: 5600 },
      { libraryItemId: 'sofa', x: 4700, y: 5600 },
      { libraryItemId: 'desk-island-4', x: 1400, y: 1500 },
      { libraryItemId: 'desk-island-4', x: 4300, y: 1500 },
      { libraryItemId: 'meeting-4', x: 8200, y: 1500 },
      { libraryItemId: 'meeting-6', x: 8000, y: 3600 },
    ],
  },
  {
    id: 'template-dense',
    name: '高密度執務',
    description: '席数を確保しつつ中央通路を確保する高密度テンプレートです。',
    room: {
      name: '高密度オフィス',
      width: 15000,
      height: 9000,
      wallThickness: 180,
      doors: [
        {
          id: 'door-entry-1',
          name: '入口',
          wall: 'left',
          offset: 1700,
          width: 1200,
          swing: 'inward',
        },
      ],
    },
    zones: [
      {
        name: '執務メイン',
        type: 'work',
        color: '#bfdbfe',
        rect: { x: 1200, y: 900, width: 9200, height: 6800 },
      },
      {
        name: '会議',
        type: 'meeting',
        color: '#ddd6fe',
        rect: { x: 10900, y: 1100, width: 2900, height: 2800 },
      },
      {
        name: '共用',
        type: 'support',
        color: '#fde68a',
        rect: { x: 10900, y: 4400, width: 2900, height: 2700 },
      },
    ],
    objects: [
      { libraryItemId: 'desk-free-address', x: 1700, y: 1500 },
      { libraryItemId: 'desk-free-address', x: 1700, y: 3600 },
      { libraryItemId: 'desk-island-4', x: 5600, y: 1800 },
      { libraryItemId: 'desk-island-4', x: 5600, y: 4200 },
      { libraryItemId: 'meeting-4', x: 11300, y: 1500 },
      { libraryItemId: 'locker', x: 11100, y: 5000, rotation: 90 },
      { libraryItemId: 'copier', x: 12600, y: 5200 },
    ],
  },
];
