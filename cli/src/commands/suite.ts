import { ApiClient } from '../lib/api-client';

export interface RunSuiteInput {
  target_id: string;
  suite_id: string;
  profile_id?: string;
  profile_version?: string;
}

export async function runSuite(client: ApiClient, input: RunSuiteInput) {
  return client.post('/runs', {
    target_id: input.target_id,
    suite_id: input.suite_id,
    profile_id: input.profile_id,
    profile_version: input.profile_version
  });
}
