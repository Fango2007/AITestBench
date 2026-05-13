import { listInferenceServers } from '../models/inference-server.js';
import { nowIso } from '../models/repositories.js';
import { buildInferenceServerAuthHeaders } from './inference-server-auth.js';
import { probeServer } from './inference-server-probe.js';

export type InferenceServerHealth = {
  server_id: string;
  ok: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  checked_at: string;
  error?: string | null;
};

const DEFAULT_TIMEOUT_MS = 5000;

export async function checkInferenceServerHealth(): Promise<InferenceServerHealth[]> {
  const timeoutMs = Number(process.env.CONNECTIVITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const servers = listInferenceServers();
  const checkedAt = nowIso();
  const results = await Promise.all(
    servers.map(async (server) => {
      const schemaFamilies = Array.isArray(server.runtime.api.schema_family)
        ? server.runtime.api.schema_family
        : [server.runtime.api.schema_family];
      const result = await probeServer({
        base_url: server.endpoints.base_url,
        schema_families: schemaFamilies.length > 0 ? schemaFamilies : ['openai-compatible'],
        auth_headers: buildInferenceServerAuthHeaders(server),
        timeout_ms: timeoutMs,
        parseModels: false
      });
      return {
        server_id: server.inference_server.server_id,
        ok: result.ok,
        status_code: result.status_code,
        response_time_ms: result.response_time_ms,
        checked_at: checkedAt,
        error: result.error ?? null
      };
    })
  );
  return results;
}
