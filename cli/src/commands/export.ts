import { ApiClient } from '../lib/api-client';

export async function exportResults(client: ApiClient, format: 'json' | 'csv', runId: string) {
  return client.get(`/export?format=${format}&run_id=${encodeURIComponent(runId)}`);
}
