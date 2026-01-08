import { ProfileRecord, getProfileById, listProfiles, upsertProfile } from '../models/profile';

export interface ProfileInput {
  id: string;
  version: string;
  name: string;
  description?: string | null;
  generation_parameters?: Record<string, unknown> | null;
  context_strategy?: Record<string, unknown> | null;
  test_selection?: Record<string, unknown> | null;
  execution_behaviour?: Record<string, unknown> | null;
}

export function saveProfile(input: ProfileInput): ProfileRecord {
  return upsertProfile({
    id: input.id,
    version: input.version,
    name: input.name,
    description: input.description ?? null,
    generation_parameters: input.generation_parameters ?? null,
    context_strategy: input.context_strategy ?? null,
    test_selection: input.test_selection ?? null,
    execution_behaviour: input.execution_behaviour ?? null
  });
}

export function fetchProfiles(): ProfileRecord[] {
  return listProfiles();
}

export function fetchProfile(id: string, version: string): ProfileRecord | null {
  return getProfileById(id, version);
}
