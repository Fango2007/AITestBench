import { ApiClient } from '../lib/api-client.ts';

export async function listModels(client: ApiClient) {
  return client.get('/models');
}
