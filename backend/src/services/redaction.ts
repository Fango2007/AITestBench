const SENSITIVE_KEYS = ['api_key', 'authorization', 'token', 'secret'];

export function redactString(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(/([A-Za-z0-9-_]{6,})/g, '***');
}

export function redactObject<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = Array.isArray(input) ? [] : {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      output[key] = '***';
      continue;
    }

    if (value && typeof value === 'object') {
      output[key] = redactObject(value as Record<string, unknown>);
      continue;
    }

    if (typeof value === 'string') {
      output[key] = redactString(value);
      continue;
    }

    output[key] = value;
  }

  return output as T;
}
