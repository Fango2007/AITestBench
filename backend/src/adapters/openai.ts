export interface OpenAIRequest {
  path: string;
  method: 'POST';
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface OpenAIAdapterConfig {
  baseUrl: string;
  apiKey?: string | null;
  defaultModel?: string | null;
}

export function buildOpenAIRequest(
  config: OpenAIAdapterConfig,
  payload: Record<string, unknown>
): OpenAIRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }

  return {
    path: '/v1/chat/completions',
    method: 'POST',
    headers,
    body: {
      model: config.defaultModel ?? payload.model,
      ...payload
    }
  };
}
