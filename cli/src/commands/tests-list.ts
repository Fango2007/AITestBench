import { ApiClient } from '../lib/api-client.ts';

export async function listTests(client: ApiClient) {
  return client.get('/tests');
}
