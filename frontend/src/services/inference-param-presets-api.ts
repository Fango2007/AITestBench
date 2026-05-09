import { apiDelete, apiGet, apiPatch, apiPost } from './api.js';

export interface InferenceParams {
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  quantization_level: string | null;
  stream: boolean | null;
}

export interface InferenceParamPreset {
  id: string;
  name: string;
  parameters: InferenceParams;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_INFERENCE_PARAMS: InferenceParams = {
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 2048,
  quantization_level: null,
  stream: false
};

export async function listInferenceParamPresets(): Promise<InferenceParamPreset[]> {
  const response = await apiGet<{ items: InferenceParamPreset[] }>('/inference-param-presets');
  return response.items;
}

export async function createInferenceParamPreset(input: {
  name: string;
  parameters: InferenceParams;
}): Promise<InferenceParamPreset> {
  return apiPost<InferenceParamPreset>('/inference-param-presets', input);
}

export async function updateInferenceParamPreset(
  id: string,
  input: { name?: string; parameters?: InferenceParams }
): Promise<InferenceParamPreset> {
  return apiPatch<InferenceParamPreset>(`/inference-param-presets/${id}`, input);
}

export async function deleteInferenceParamPreset(id: string): Promise<void> {
  await apiDelete(`/inference-param-presets/${id}`);
}
