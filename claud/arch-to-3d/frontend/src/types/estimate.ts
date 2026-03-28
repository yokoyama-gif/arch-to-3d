export type EstimateCategory = "earthwork" | "paving" | "fence" | "landscaping";

export const categoryLabels: Record<EstimateCategory, string> = {
  earthwork: "土工事",
  paving: "舗装工事",
  fence: "塀・フェンス",
  landscaping: "植栽・造園",
};

export const categoryIcons: Record<EstimateCategory, string> = {
  earthwork: "⛏",
  paving: "🛣",
  fence: "🧱",
  landscaping: "🌿",
};

export interface EstimateItem {
  id: string;
  category: EstimateCategory;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  remarks: string;
  aiSuggested: boolean;
}

export interface EstimateProject {
  name: string;
  clientName: string;
  siteAddress: string;
  items: EstimateItem[];
  taxRate: number;
}

export interface PdfAnalysisResponse {
  items: EstimateItem[];
  warnings: string[];
}

export function createDefaultItems(): EstimateItem[] {
  let counter = 0;
  const id = () => `item-${++counter}`;

  return [
    // 土工事
    { id: id(), category: "earthwork", name: "掘削工事", specification: "バックホウ 0.45m3級", quantity: 0, unit: "m3", unitPrice: 3500, remarks: "", aiSuggested: false },
    { id: id(), category: "earthwork", name: "埋戻し", specification: "発生土利用", quantity: 0, unit: "m3", unitPrice: 1800, remarks: "", aiSuggested: false },
    { id: id(), category: "earthwork", name: "盛土", specification: "山砂", quantity: 0, unit: "m3", unitPrice: 4500, remarks: "", aiSuggested: false },
    { id: id(), category: "earthwork", name: "残土搬出・処分", specification: "10tダンプ運搬", quantity: 0, unit: "m3", unitPrice: 5500, remarks: "", aiSuggested: false },
    { id: id(), category: "earthwork", name: "整地・転圧", specification: "プレートコンパクター", quantity: 0, unit: "m2", unitPrice: 800, remarks: "", aiSuggested: false },
    // 舗装工事
    { id: id(), category: "paving", name: "コンクリート舗装", specification: "t=120 ワイヤーメッシュ入", quantity: 0, unit: "m2", unitPrice: 6500, remarks: "", aiSuggested: false },
    { id: id(), category: "paving", name: "アスファルト舗装", specification: "t=50 路盤t=150", quantity: 0, unit: "m2", unitPrice: 4800, remarks: "", aiSuggested: false },
    { id: id(), category: "paving", name: "インターロッキング", specification: "t=60 砂目地", quantity: 0, unit: "m2", unitPrice: 9500, remarks: "", aiSuggested: false },
    { id: id(), category: "paving", name: "縁石", specification: "コンクリート縁石 120×120", quantity: 0, unit: "m", unitPrice: 3200, remarks: "", aiSuggested: false },
    { id: id(), category: "paving", name: "側溝", specification: "U字溝 240×240", quantity: 0, unit: "m", unitPrice: 8500, remarks: "", aiSuggested: false },
    // 塀・フェンス
    { id: id(), category: "fence", name: "CB塀（3段）", specification: "C-120 鉄筋補強", quantity: 0, unit: "m", unitPrice: 12000, remarks: "", aiSuggested: false },
    { id: id(), category: "fence", name: "CB塀（5段）", specification: "C-120 鉄筋補強", quantity: 0, unit: "m", unitPrice: 18000, remarks: "", aiSuggested: false },
    { id: id(), category: "fence", name: "CB塀（7段）", specification: "C-150 鉄筋補強", quantity: 0, unit: "m", unitPrice: 26000, remarks: "", aiSuggested: false },
    { id: id(), category: "fence", name: "メッシュフェンス", specification: "H=800 スチール", quantity: 0, unit: "m", unitPrice: 8500, remarks: "", aiSuggested: false },
    { id: id(), category: "fence", name: "アルミフェンス", specification: "H=800 縦格子", quantity: 0, unit: "m", unitPrice: 15000, remarks: "", aiSuggested: false },
    { id: id(), category: "fence", name: "門扉", specification: "アルミ引戸 W=1200", quantity: 0, unit: "箇所", unitPrice: 85000, remarks: "", aiSuggested: false },
    { id: id(), category: "fence", name: "カーポート", specification: "2台用 アルミ製", quantity: 0, unit: "式", unitPrice: 350000, remarks: "", aiSuggested: false },
    // 植栽・造園
    { id: id(), category: "landscaping", name: "芝張り", specification: "高麗芝 目土仕上", quantity: 0, unit: "m2", unitPrice: 2800, remarks: "", aiSuggested: false },
    { id: id(), category: "landscaping", name: "砕石敷き", specification: "6号砕石 t=50", quantity: 0, unit: "m2", unitPrice: 2200, remarks: "", aiSuggested: false },
    { id: id(), category: "landscaping", name: "防草シート", specification: "ザバーン240G相当", quantity: 0, unit: "m2", unitPrice: 1500, remarks: "", aiSuggested: false },
    { id: id(), category: "landscaping", name: "高木", specification: "シマトネリコ H=3.0m", quantity: 0, unit: "本", unitPrice: 35000, remarks: "", aiSuggested: false },
    { id: id(), category: "landscaping", name: "中木", specification: "ドウダンツツジ H=1.5m", quantity: 0, unit: "本", unitPrice: 15000, remarks: "", aiSuggested: false },
    { id: id(), category: "landscaping", name: "低木", specification: "サツキ H=0.3m", quantity: 0, unit: "本", unitPrice: 2500, remarks: "", aiSuggested: false },
    { id: id(), category: "landscaping", name: "花壇", specification: "レンガ積み", quantity: 0, unit: "m2", unitPrice: 12000, remarks: "", aiSuggested: false },
  ];
}

export function itemAmount(item: EstimateItem): number {
  return item.quantity * item.unitPrice;
}

export function categorySubtotal(items: EstimateItem[], category: EstimateCategory): number {
  return items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + itemAmount(item), 0);
}

export function grandTotal(items: EstimateItem[]): number {
  return items.reduce((sum, item) => sum + itemAmount(item), 0);
}
