import { ApiClient } from '../lib/api-client.js';

export interface RunTestInput {
  inference_server_id: string;
  test_id: string;
  reps?: number;
  profile_id?: string;
  profile_version?: string;
}

export async function runTest(client: ApiClient, input: RunTestInput) {
  return client.post('/runs', {
    inference_server_id: input.inference_server_id,
    test_id: input.test_id,
    profile_id: input.profile_id,
    profile_version: input.profile_version
  });
}
