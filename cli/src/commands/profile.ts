import { ApiClient } from '../lib/api-client.ts';

export async function listProfiles(client: ApiClient) {
  return client.get('/profiles');
}

export async function createProfile(client: ApiClient, payload: Record<string, unknown>) {
  return client.post('/profiles', payload);
}
