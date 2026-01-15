const BASE_URL =
  (import.meta.env.VITE_AITESTBENCH_API_BASE_URL as string | undefined)
  ?? 'http://localhost:8080';

function headers(): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  const token = import.meta.env.VITE_AITESTBENCH_API_TOKEN as string | undefined;
  if (token) {
    headers['x-api-token'] = token;
  }
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: headers() });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

export async function apiPut<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

export async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: (() => {
      const { 'content-type': _contentType, ...rest } = headers();
      return rest;
    })()
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      issues?: Array<{ message?: string }>;
    };
    if (payload.issues && payload.issues.length > 0) {
      const issueText = payload.issues
        .map((issue) => issue.message)
        .filter(Boolean)
        .join('; ');
      return `${payload.error ?? payload.message ?? 'Validation failed'}${issueText ? `: ${issueText}` : ''}`;
    }
    return payload.error ?? payload.message ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}
