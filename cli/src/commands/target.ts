import { ApiClient } from '../lib/api-client';

export async function addTarget(client: ApiClient, input: Record<string, unknown>) {
  return client.post('/targets', input);
}
