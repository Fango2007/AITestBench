import { ApiClient } from '../lib/api-client.ts';

export async function addTarget(client: ApiClient, input: Record<string, unknown>) {
  return client.post('/targets', input);
}

export async function deleteTarget(client: ApiClient, targetId: string) {
  return client.deleteWithBody(`/targets/${targetId}`);
}

export async function updateTarget(client: ApiClient, targetId: string, input: Record<string, unknown>) {
  return client.put(`/targets/${targetId}`, input);
}
