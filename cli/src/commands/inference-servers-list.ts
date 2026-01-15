import { ApiClient } from '../lib/api-client.js';

export async function listInferenceServers(client: ApiClient) {
  return client.get('/inference-servers');
}
