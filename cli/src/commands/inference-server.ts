import { ApiClient } from '../lib/api-client.js';

export async function addInferenceServer(client: ApiClient, input: Record<string, unknown>) {
  return client.post('/inference-servers', input);
}

export async function archiveInferenceServer(client: ApiClient, serverId: string) {
  return client.post(`/inference-servers/${serverId}/archive`, {});
}

export async function updateInferenceServer(client: ApiClient, serverId: string, input: Record<string, unknown>) {
  return client.patch(`/inference-servers/${serverId}`, input);
}
