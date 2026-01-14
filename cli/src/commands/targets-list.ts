import { ApiClient } from '../lib/api-client.js';

export async function listTargets(client: ApiClient) {
  return client.get('/targets');
}
