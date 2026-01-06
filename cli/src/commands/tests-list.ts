import { ApiClient } from '../lib/api-client';

export async function listTests(client: ApiClient) {
  return client.get('/tests');
}
