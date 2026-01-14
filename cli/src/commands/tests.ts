import { ApiClient } from '../lib/api-client.js';

export async function reloadTests(client: ApiClient) {
  return client.post('/tests/reload', {});
}
