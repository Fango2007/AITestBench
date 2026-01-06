import { listTestDefinitions, upsertTestDefinition } from '../models/test-definition';
import { loadTestsFromDir } from '../plugins/loader';
import { DEFAULT_TESTS_DIR } from '../plugins/config';

export function fetchTests() {
  return listTestDefinitions();
}

export function reloadTests(dirPath = DEFAULT_TESTS_DIR) {
  const { tests, errors } = loadTestsFromDir(dirPath);
  for (const test of tests) {
    upsertTestDefinition({
      id: test.id,
      version: test.version,
      name: test.name,
      description: test.description,
      category: null,
      tags: [],
      protocols: test.protocols,
      spec_path: test.spec_path,
      runner_type: test.runner_type,
      request_template: (test.raw.request as Record<string, unknown>) ?? null,
      assertions: (test.raw.assertions as Record<string, unknown>[]) ?? [],
      metric_rules: (test.raw.metrics as Record<string, unknown>) ?? null
    });
  }
  return { count: tests.length, errors };
}
