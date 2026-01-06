import { ApiClient } from '../lib/api-client';

export async function listTargets(client: ApiClient) {
  return client.get('/targets');
}
