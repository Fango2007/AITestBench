import { ApiClient } from '../lib/api-client.js';

export async function listSuites(client: ApiClient) {
  return client.get('/suites');
}
