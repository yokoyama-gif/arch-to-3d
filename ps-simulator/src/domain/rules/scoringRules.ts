/** スコアリング重み */
export const scoringWeights = {
  psArea: 0.30,
  totalPipeLength: 0.25,
  slopePenalty: 0.25,
  maintenance: 0.20,
};

/** 点検性ルール */
export const maintenanceRules = {
  recommendedMinPsWidthMm: 750,
  recommendedMinPsDepthMm: 500,
  goodPsWidthMm: 800,
  goodPsDepthMm: 600,
};
