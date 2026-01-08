import { ApiClient } from '../lib/api-client.ts';

export async function listSuites(client: ApiClient) {
  return client.get('/suites');
}
