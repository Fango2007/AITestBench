import { ApiClient } from '../lib/api-client.js';

export interface RunSuiteInput {
  inference_server_id: string;
  suite_id: string;
  profile_id?: string;
  profile_version?: string;
}

export async function runSuite(client: ApiClient, input: RunSuiteInput) {
  return client.post('/runs', {
    inference_server_id: input.inference_server_id,
    suite_id: input.suite_id,
    profile_id: input.profile_id,
    profile_version: input.profile_version
  });
}

export interface CreateSuiteInput {
  id: string;
  name: string;
  ordered_test_ids?: string[];
  stop_on_fail?: boolean;
}

export async function createSuite(client: ApiClient, input: CreateSuiteInput) {
  return client.post('/suites', {
    id: input.id,
    name: input.name,
    ordered_test_ids: input.ordered_test_ids ?? [],
    stop_on_fail: input.stop_on_fail ?? false
  });
}
