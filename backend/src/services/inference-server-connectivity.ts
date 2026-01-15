import { listInferenceServers } from '../models/inference-server.js';
import { nowIso } from '../models/repositories.js';

export type InferenceServerHealth = {
  server_id: string;
  ok: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  checked_at: string;
};

const DEFAULT_TIMEOUT_MS = 5000;

async function checkServer(
  baseUrl: string,
  paths: string[],
  timeoutMs: number
): Promise<{ ok: boolean; status_code: number | null; response_time_ms: number | null }> {
  const startedAt = Date.now();
  let lastStatus: number | null = null;
  for (const path of paths) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(path, baseUrl).toString();
      const response = await fetch(url, { method: 'GET', signal: controller.signal });
      const duration = Date.now() - startedAt;
      lastStatus = response.status;
      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        const ok = contentType.includes('application/json');
        if (ok) {
          return { ok: true, status_code: response.status, response_time_ms: duration };
        }
      }
    } catch {
      // fall through to next path
    } finally {
      clearTimeout(timeout);
    }
  }
  const duration = Date.now() - startedAt;
  return { ok: false, status_code: lastStatus, response_time_ms: duration };
}

export async function checkInferenceServerHealth(): Promise<InferenceServerHealth[]> {
  const timeoutMs = Number(process.env.CONNECTIVITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const servers = listInferenceServers();
  const checkedAt = nowIso();
  const results = await Promise.all(
    servers.map(async (server) => {
      const schemaFamilies = Array.isArray(server.runtime.api.schema_family)
        ? server.runtime.api.schema_family
        : [server.runtime.api.schema_family];
      const paths = schemaFamilies
        .filter((family) => family !== 'custom')
        .map((family) => (family === 'ollama' ? '/api/tags' : '/v1/models'));
      const probePaths = paths.length > 0 ? paths : ['/v1/models'];
      const { ok, status_code, response_time_ms } = await checkServer(
        server.endpoints.base_url,
        probePaths,
        timeoutMs
      );
      return {
        server_id: server.inference_server.server_id,
        ok,
        status_code,
        response_time_ms,
        checked_at: checkedAt
      };
    })
  );
  return results;
}
