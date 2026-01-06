import { ApiClient } from '../lib/api-client';

export async function reloadTests(client: ApiClient) {
  return client.post('/tests/reload', {});
}
