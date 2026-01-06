import { ApiClient } from '../lib/api-client';

export async function listSuites(client: ApiClient) {
  return client.get('/suites');
}
