const DEFAULT_BASE_URL = 'http://localhost:8080';

export class ApiError extends Error {
  status: number;
  path: string;
  body: unknown;
  baseUrl: string;

  constructor(message: string, status: number, path: string, body: unknown, baseUrl: string) {
    super(message);
    this.status = status;
    this.path = path;
    this.body = body;
    this.baseUrl = baseUrl;
  }
}

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

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers()
    });
    const body = await this.parseBody(response);
    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.status}`, response.status, path, body, this.baseUrl);
    }
    return body as T;
  }

  async post<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await this.parseBody(response);
    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.status}`, response.status, path, body, this.baseUrl);
    }
    return body as T;
  }

  async put<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.jsonHeaders(),
      body: JSON.stringify(payload)
    });
    const body = await this.parseBody(response);
    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.status}`, response.status, path, body, this.baseUrl);
    }
    return body as T;
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers()
    });
    const body = await this.parseBody(response);
    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.status}`, response.status, path, body, this.baseUrl);
    }
  }

  async deleteWithBody(path: string): Promise<{ ok: boolean; status: number; body?: unknown }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers()
    });
    const body = await this.parseBody(response);
    return { ok: response.ok, status: response.status, body };
  }
}
