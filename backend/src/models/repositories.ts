export function nowIso(): string {
  return new Date().toISOString();
}

export function serializeJson(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

export function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return JSON.parse(value) as T;
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) {
    return [];
  }
  return JSON.parse(value) as T[];
}

export function serializeSnapshot(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function serializeSweepGroupings(value: unknown): string {
  return JSON.stringify(value ?? {});
}
