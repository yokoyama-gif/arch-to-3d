import axios from "axios";
import type {
  DrawingImportResponse,
  DrawingUnit,
  SkyFactorRequest,
  SkyFactorResponse,
} from "../types/skyfactor";

const api = axios.create({ baseURL: "/api" });

function normalizeError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.length > 0) {
      return new Error(detail);
    }
    return new Error(error.message || "API request failed");
  }
  return error instanceof Error ? error : new Error("API request failed");
}

export async function analyzeSkyFactor(
  payload: SkyFactorRequest
): Promise<SkyFactorResponse> {
  try {
    const { data } = await api.post("/skyfactor/analyze", payload);
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function importDrawing(
  drawing: File,
  options: {
    unit: DrawingUnit;
    default_planned_height: number;
    default_context_height: number;
  }
): Promise<DrawingImportResponse> {
  const formData = new FormData();
  formData.append("drawing", drawing);
  formData.append("unit", options.unit);
  formData.append(
    "default_planned_height",
    String(options.default_planned_height)
  );
  formData.append(
    "default_context_height",
    String(options.default_context_height)
  );

  try {
    const { data } = await api.post("/import/drawing", formData);
    return data;
  } catch (error) {
    throw normalizeError(error);
  }
}
