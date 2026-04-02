import { BoxPreset, JudgmentSettings, PlanTemplate } from '../types';

// ===== 宅配ボックスプリセット =====
export const defaultBoxPresets: BoxPreset[] = [
  {
    id: 'slim',
    name: '薄型宅配ボックス',
    category: 'slim',
    width: 400,
    depth: 350,
    height: 500,
    frontSpace: 600,
    maintenanceSpace: 50,
    hasAnchor: true,
    mountType: 'wall',
    unitType: 'single',
    hasMailIntegration: false,
  },
  {
    id: 'small',
    name: '小型宅配ボックス',
    category: 'small',
    width: 400,
    depth: 450,
    height: 600,
    frontSpace: 600,
    maintenanceSpace: 50,
    hasAnchor: true,
    mountType: 'wall',
    unitType: 'single',
    hasMailIntegration: false,
  },
  {
    id: 'medium',
    name: '標準宅配ボックス',
    category: 'medium',
    width: 500,
    depth: 500,
    height: 800,
    frontSpace: 700,
    maintenanceSpace: 100,
    hasAnchor: true,
    mountType: 'wall',
    unitType: 'connected',
    hasMailIntegration: false,
  },
  {
    id: 'large',
    name: '大型荷物対応ボックス',
    category: 'large',
    width: 600,
    depth: 600,
    height: 1000,
    frontSpace: 800,
    maintenanceSpace: 100,
    hasAnchor: true,
    mountType: 'freestanding',
    unitType: 'connected',
    hasMailIntegration: false,
  },
  {
    id: 'mail_integrated',
    name: 'メール一体型ボックス',
    category: 'mail_integrated',
    width: 500,
    depth: 400,
    height: 1700,
    frontSpace: 700,
    maintenanceSpace: 100,
    hasAnchor: true,
    mountType: 'wall',
    unitType: 'connected',
    hasMailIntegration: true,
  },
  {
    id: 'large_freestanding',
    name: '据置大型タイプ',
    category: 'large_freestanding',
    width: 700,
    depth: 600,
    height: 1200,
    frontSpace: 900,
    maintenanceSpace: 150,
    hasAnchor: false,
    mountType: 'freestanding',
    unitType: 'single',
    hasMailIntegration: false,
  },
];

// ===== 設備プリセット（配置用） =====
export const equipmentPresets = [
  { type: 'mailbox' as const, name: 'メールボックス', width: 400, depth: 200, height: 1200 },
  { type: 'auto_lock_panel' as const, name: 'オートロック盤', width: 300, depth: 100, height: 1400 },
  { type: 'intercom' as const, name: 'インターホン', width: 200, depth: 80, height: 300 },
  { type: 'fire_extinguisher' as const, name: '消火器ボックス', width: 300, depth: 200, height: 800 },
  { type: 'pillar' as const, name: '柱', width: 300, depth: 300, height: 3000 },
];

export const doorPresets = [
  { name: '片開きドア', doorType: 'single' as const, width: 900, depth: 50, doorWidth: 800 },
  { name: '両開きドア', doorType: 'double' as const, width: 1800, depth: 50, doorWidth: 800 },
  { name: '引き戸', doorType: 'sliding' as const, width: 900, depth: 50, doorWidth: 850 },
  { name: '自動ドア', doorType: 'auto' as const, width: 1800, depth: 50, doorWidth: 1600 },
];

// ===== デフォルト判定基準 =====
export const defaultJudgmentSettings: JudgmentSettings = {
  minCorridorWidth: 800,
  recommendedCorridorWidth: 1200,
  frontOperationSpace: 600,
  doorClearance: 800,
  entranceClearance: 1200,
};

// ===== テンプレート =====
export const defaultTemplates: PlanTemplate[] = [
  {
    id: 'small_apartment',
    name: '小規模アパート用エントランス',
    description: '6〜12戸程度の木造3階アパート。風除室なしの簡素なエントランス。',
    room: { name: 'エントランス', width: 3000, depth: 2500 },
    objects: [
      { type: 'door', name: '玄関ドア', x: 1050, y: 2450, width: 900, depth: 50, rotation: 0, doorType: 'single', doorSwing: 'right', doorWidth: 800 },
      { type: 'mailbox', name: 'メールボックス', x: 100, y: 100, width: 600, depth: 200, rotation: 0 },
    ],
  },
  {
    id: 'vestibule',
    name: '風除室ありタイプ',
    description: '風除室を含むエントランス。自動ドア＋片開きドアの構成。',
    room: { name: '風除室', width: 4000, depth: 3000 },
    objects: [
      { type: 'door', name: '外部自動ドア', x: 1100, y: 2950, width: 1800, depth: 50, rotation: 0, doorType: 'auto', doorWidth: 1600 },
      { type: 'door', name: '内部ドア', x: 1550, y: 0, width: 900, depth: 50, rotation: 0, doorType: 'single', doorSwing: 'right', doorWidth: 800 },
      { type: 'auto_lock_panel', name: 'オートロック', x: 100, y: 0, width: 300, depth: 100, rotation: 0 },
      { type: 'mailbox', name: 'メールボックス', x: 100, y: 300, width: 600, depth: 200, rotation: 0 },
    ],
  },
  {
    id: 'corridor',
    name: '共用廊下設置タイプ',
    description: '共用廊下の一角に宅配ボックスを配置するパターン。',
    room: { name: '共用廊下', width: 5000, depth: 2000 },
    objects: [
      { type: 'pillar', name: '柱1', x: 0, y: 0, width: 300, depth: 300, rotation: 0 },
      { type: 'pillar', name: '柱2', x: 4700, y: 0, width: 300, depth: 300, rotation: 0 },
    ],
  },
  {
    id: 'autolock_side',
    name: 'オートロック横設置タイプ',
    description: 'オートロック操作盤の横に宅配ボックスを配置。',
    room: { name: 'エントランス', width: 3500, depth: 2500 },
    objects: [
      { type: 'door', name: '玄関ドア', x: 1300, y: 2450, width: 900, depth: 50, rotation: 0, doorType: 'single', doorSwing: 'right', doorWidth: 800 },
      { type: 'auto_lock_panel', name: 'オートロック', x: 100, y: 100, width: 300, depth: 100, rotation: 0 },
    ],
  },
  {
    id: 'mail_corner',
    name: 'メールコーナー一体型',
    description: 'メールボックスと宅配ボックスを一体的に配置するコーナー。',
    room: { name: 'メールコーナー', width: 3000, depth: 2000 },
    objects: [
      { type: 'door', name: '入口', x: 1050, y: 1950, width: 900, depth: 50, rotation: 0, doorType: 'single', doorSwing: 'left', doorWidth: 800 },
      { type: 'mailbox', name: 'メールボックス', x: 100, y: 100, width: 800, depth: 200, rotation: 0 },
    ],
  },
];

// ===== 色設定 =====
export const objectColors: Record<string, string> = {
  delivery_box: '#4A90D9',
  mailbox: '#7B68EE',
  auto_lock_panel: '#FF8C00',
  intercom: '#FF6347',
  fire_extinguisher: '#DC143C',
  pillar: '#808080',
  door: '#8B4513',
  wall: '#2F2F2F',
  obstacle: '#A0A0A0',
};

export const judgmentColors = {
  ok: '#4CAF50',
  warning: '#FFC107',
  ng: '#F44336',
};
