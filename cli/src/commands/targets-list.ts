import { ApiClient } from '../lib/api-client.ts';

export async function listTargets(client: ApiClient) {
  return client.get('/targets');
}
