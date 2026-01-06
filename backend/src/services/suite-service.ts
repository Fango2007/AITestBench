import { listSuites, upsertSuite } from '../models/suite';

export interface SuiteInput {
  id: string;
  name: string;
  ordered_test_ids?: string[];
  filters?: Record<string, unknown> | null;
  stop_on_fail?: boolean;
}

export function saveSuite(input: SuiteInput) {
  return upsertSuite({
    id: input.id,
    name: input.name,
    ordered_test_ids: input.ordered_test_ids ?? [],
    filters: input.filters ?? null,
    stop_on_fail: input.stop_on_fail ?? false
  });
}

export function fetchSuites() {
  return listSuites();
}
