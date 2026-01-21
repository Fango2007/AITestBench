import { apiGet, apiPatch, apiPost } from './api.js';

export type ModelProvider =
  | 'openai'
  | 'meta'
  | 'mistral'
  | 'qwen'
  | 'google'
  | 'cohere'
  | 'deepseek'
  | 'anthropic'
  | 'nvidia'
  | 'zai'
  | 'custom'
  | 'unknown';
export type ModelQuantisationMethod = 'gguf' | 'gptq' | 'awq' | 'mlx' | 'none' | 'unknown';

export interface ModelRecord {
  model: {
    model_id: string;
    server_id: string;
    display_name: string;
    active: boolean;
    archived: boolean;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
  };
  identity: {
    provider: ModelProvider;
    family: string | null;
    version: string | null;
    revision: string | null;
    checksum: string | null;
  };
  architecture: {
    type: string;
    parameter_count: number | null;
    precision: string;
    quantisation: {
      method: ModelQuantisationMethod;
      bits: number | null;
      group_size: number | null;
      scheme?: string | null;
      variant?: string | null;
      weight_format?: string | null;
    };
  };
  capabilities: {
    generation: { text: boolean; json_schema_output: boolean; tools: boolean; embeddings: boolean };
    multimodal: { vision: boolean; audio: boolean };
    reasoning: { supported: boolean; explicit_tokens: boolean };
  };
  limits: {
    context_window_tokens: number | null;
    max_output_tokens: number | null;
    max_images: number | null;
    max_batch_size: number | null;
  };
}

export interface ModelInput {
  model?: Partial<ModelRecord['model']>;
  identity?: Partial<ModelRecord['identity']>;
  architecture?: Partial<ModelRecord['architecture']>;
  capabilities?: Partial<ModelRecord['capabilities']>;
  limits?: Partial<ModelRecord['limits']>;
}

export async function listModels(): Promise<ModelRecord[]> {
  return apiGet<ModelRecord[]>('/models');
}

export async function getModel(serverId: string, modelId: string): Promise<ModelRecord> {
  return apiGet<ModelRecord>(`/models/${serverId}/${encodeURIComponent(modelId)}`);
}

export async function createModel(input: ModelInput): Promise<ModelRecord> {
  return apiPost<ModelRecord>('/models', input);
}

export async function updateModel(serverId: string, modelId: string, updates: ModelInput): Promise<ModelRecord> {
  return apiPatch<ModelRecord>(`/models/${serverId}/${encodeURIComponent(modelId)}`, updates);
}
