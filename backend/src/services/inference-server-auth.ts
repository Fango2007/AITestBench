import { InferenceServerRecord } from '../models/inference-server.js';

export function resolveInferenceServerToken(server: InferenceServerRecord): string | null {
  if (server.auth.type === 'none') {
    return null;
  }
  if (server.auth.token?.trim()) {
    return server.auth.token.trim();
  }
  const tokenEnv = server.auth.token_env;
  return tokenEnv ? process.env[tokenEnv] ?? null : null;
}

export function buildInferenceServerAuthHeaders(server: InferenceServerRecord): Record<string, string> {
  const token = resolveInferenceServerToken(server);
  if (!token) {
    return {};
  }
  const headerName = server.auth.header_name || 'Authorization';
  if (server.auth.type === 'bearer' || server.auth.type === 'oauth') {
    return { [headerName]: `Bearer ${token}` };
  }
  if (server.auth.type === 'basic') {
    return { [headerName]: `Basic ${token}` };
  }
  return { [headerName]: token };
}

export function buildProbeAuthHeaders(auth: {
  type: string;
  header_name: string;
  token?: string | null;
  token_env?: string | null;
}): Record<string, string> {
  if (auth.type === 'none') return {};
  const token = auth.token?.trim() || (auth.token_env ? process.env[auth.token_env] ?? null : null);
  if (!token) return {};
  const headerName = auth.header_name || 'Authorization';
  if (auth.type === 'bearer' || auth.type === 'oauth') return { [headerName]: `Bearer ${token}` };
  if (auth.type === 'basic') return { [headerName]: `Basic ${token}` };
  return { [headerName]: token };
}

export function authHeaderPreview(server: InferenceServerRecord): Record<string, string> {
  if (server.auth.type === 'none') {
    return {};
  }
  const headerName = server.auth.header_name || 'Authorization';
  const placeholder = server.auth.token ? '<stored token>' : server.auth.token_env ? `$${server.auth.token_env}` : '<token>';
  if (server.auth.type === 'bearer' || server.auth.type === 'oauth') {
    return { [headerName]: `Bearer ${placeholder}` };
  }
  if (server.auth.type === 'basic') {
    return { [headerName]: `Basic ${placeholder}` };
  }
  return { [headerName]: placeholder };
}
