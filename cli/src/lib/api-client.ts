const DEFAULT_BASE_URL = 'http://localhost:8080';

export interface ApiClientOptions {
  baseUrl?: string;
  token?: string;
}

export class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl
      ?? process.env.VITE_AITESTBENCH_API_BASE_URL
      ?? DEFAULT_BASE_URL;
    this.token = options.token ?? process.env.AITESTBENCH_API_TOKEN;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['x-api-token'] = this.token;
    }
    return headers;
  }

  private jsonHeaders(): Record<string, string> {
    return {
      ...this.headers(),
      'content-type': 'application/json'
    };
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async put<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.jsonHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers()
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  }

  async deleteWithBody(path: string): Promise<{ ok: boolean; status: number; body?: unknown }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers()
    });
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { ok: response.ok, status: response.status, body };
  }
}
