import { ApiClient } from '../lib/api-client.js';

export async function listModels(client: ApiClient) {
  return client.get('/models');
}
