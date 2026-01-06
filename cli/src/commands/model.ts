import { ApiClient } from '../lib/api-client';

export async function listModels(client: ApiClient) {
  return client.get('/models');
}
