import { ApiClient } from '../lib/api-client.js';

export async function listTests(client: ApiClient) {
  return client.get('/tests');
}
