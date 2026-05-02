export type Shift = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  earnings: number;
  delivery_count: number;
  distance_km: number;
  area: string | null;
  weather: string | null;
  memo: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type ShiftInput = {
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  earnings: number;
  delivery_count: number;
  distance_km: number;
  area: string | null;
  weather: string | null;
  memo: string | null;
  source?: string;
};

export type ShiftFilter = {
  from?: string;
  to?: string;
  area?: string;
  weather?: string;
};

export const WEATHER_OPTIONS = ['晴', '曇', '雨', '雪', '雷'] as const;
export type Weather = (typeof WEATHER_OPTIONS)[number];
