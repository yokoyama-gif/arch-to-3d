import { PlacedObject, RoomDefinition, JudgmentResult, Score } from '../types';

function getObjectRect(obj: PlacedObject) {
  const isRotated = obj.rotation === 90 || obj.rotation === 270;
  return {
    x: obj.x,
    y: obj.y,
    width: isRotated ? obj.depth : obj.width,
    height: isRotated ? obj.width : obj.depth,
  };
}

export function calculateScore(
  room: RoomDefinition,
  objects: PlacedObject[],
  judgments: JudgmentResult[]
): Score {
  const roomArea = room.width * room.depth;
  const deliveryBoxes = objects.filter((o) => o.type === 'delivery_box');
  const doors = objects.filter((o) => o.type === 'door');
  const ngCount = judgments.filter((j) => j.level === 'ng').length;
  const warnCount = judgments.filter((j) => j.level === 'warning').length;

  if (deliveryBoxes.length === 0) {
    return { placementEfficiency: 0, circulationQuality: 0, usability: 0, spaciousness: 0, equipmentCompatibility: 0, constructability: 0, total: 0 };
  }

  // 配置効率: ボックス面積 / 部屋面積の適正比率 (10-30%が理想)
  const boxArea = deliveryBoxes.reduce((sum, b) => {
    const r = getObjectRect(b);
    return sum + r.width * r.height;
  }, 0);
  const ratio = boxArea / roomArea;
  const placementEfficiency = ratio < 0.05 ? ratio / 0.05 * 100 :
    ratio <= 0.3 ? 100 :
    Math.max(0, 100 - (ratio - 0.3) * 500);

  // 動線の良さ: NG/Warning少なさ + 扉からの距離
  const circulationBase = Math.max(0, 100 - ngCount * 30 - warnCount * 10);
  let doorProximityPenalty = 0;
  for (const door of doors) {
    const dr = getObjectRect(door);
    const doorCenterX = dr.x + dr.width / 2;
    const doorCenterY = dr.y + dr.height / 2;
    for (const box of deliveryBoxes) {
      const br = getObjectRect(box);
      const boxCenterX = br.x + br.width / 2;
      const boxCenterY = br.y + br.height / 2;
      const dist = Math.sqrt((doorCenterX - boxCenterX) ** 2 + (doorCenterY - boxCenterY) ** 2);
      if (dist < 800) doorProximityPenalty += 15;
    }
  }
  const circulationQuality = Math.max(0, circulationBase - doorProximityPenalty);

  // 利用しやすさ: 操作スペース確保率
  const usability = Math.max(0, 100 - warnCount * 15 - ngCount * 25);

  // 圧迫感の少なさ: 空き面積比
  const totalObjArea = objects.reduce((sum, o) => {
    const r = getObjectRect(o);
    return sum + r.width * r.height;
  }, 0);
  const freeRatio = 1 - totalObjArea / roomArea;
  const spaciousness = Math.min(100, freeRatio * 130);

  // 他設備との整合性: 干渉なし率
  const equipmentJudgments = judgments.filter((j) =>
    j.message.includes('干渉') || j.message.includes('重なっ')
  );
  const equipmentCompatibility = Math.max(0, 100 - equipmentJudgments.length * 25);

  // 施工性: 壁付け率、アンカー有無
  const wallMounted = deliveryBoxes.filter((b) => b.mountType === 'wall').length;
  const constructability = deliveryBoxes.length > 0
    ? Math.min(100, (wallMounted / deliveryBoxes.length) * 70 + 30)
    : 50;

  const total = Math.round(
    (placementEfficiency * 0.15 +
      circulationQuality * 0.25 +
      usability * 0.2 +
      spaciousness * 0.15 +
      equipmentCompatibility * 0.15 +
      constructability * 0.1)
  );

  return {
    placementEfficiency: Math.round(placementEfficiency),
    circulationQuality: Math.round(circulationQuality),
    usability: Math.round(usability),
    spaciousness: Math.round(spaciousness),
    equipmentCompatibility: Math.round(equipmentCompatibility),
    constructability: Math.round(constructability),
    total: Math.min(100, Math.max(0, total)),
  };
}

export function getRecommendedConfig(
  totalUnits: number,
  isFamilyMix: boolean,
  ecFrequency: 'low' | 'medium' | 'high',
  wantMailIntegrated: boolean
) {
  const freqMultiplier = ecFrequency === 'low' ? 0.3 : ecFrequency === 'medium' ? 0.5 : 0.7;
  const base = Math.ceil(totalUnits * freqMultiplier);

  const configs = [
    {
      label: '最低限案',
      totalBoxes: Math.max(2, Math.ceil(base * 0.6)),
    },
    {
      label: '標準案',
      totalBoxes: Math.max(3, base),
    },
    {
      label: '余裕案',
      totalBoxes: Math.max(4, Math.ceil(base * 1.4)),
    },
  ];

  return configs.map((c) => {
    const small = Math.ceil(c.totalBoxes * 0.3);
    const large = isFamilyMix ? Math.ceil(c.totalBoxes * 0.3) : Math.ceil(c.totalBoxes * 0.15);
    const mailIntegrated = wantMailIntegrated ? 1 : 0;
    const medium = Math.max(1, c.totalBoxes - small - large - mailIntegrated);
    return {
      ...c,
      small,
      medium,
      large,
      mailIntegrated,
    };
  });
}
