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
    throw new Error(`Request failed: ${response.status}`);
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
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
