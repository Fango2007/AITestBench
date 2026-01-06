export interface OllamaRequest {
  path: string;
  method: 'POST';
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface OllamaAdapterConfig {
  baseUrl: string;
  defaultModel?: string | null;
}

export function buildOllamaRequest(
  config: OllamaAdapterConfig,
  payload: Record<string, unknown>
): OllamaRequest {
  return {
    path: '/api/chat',
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: {
      model: config.defaultModel ?? payload.model,
      ...payload
    }
  };
}
