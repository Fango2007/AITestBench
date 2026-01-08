import { ApiClient } from '../lib/api-client.ts';

export async function reloadTests(client: ApiClient) {
  return client.post('/tests/reload', {});
}
