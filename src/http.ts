import { KeldraError } from './errors.js';
import { extractErrorMessage } from './utils.js';

export class HttpClient {
  private readonly baseHeaders: Record<string, string>;

  constructor(bearerToken?: string) {
    this.baseHeaders = { 'Content-Type': 'application/json' };
    if (bearerToken) {
      this.baseHeaders['Authorization'] = `Bearer ${bearerToken}`;
    }
  }

  async get<T>(url: string): Promise<T> {
    return this.request<T>('GET', url);
  }

  async post<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>('POST', url, body);
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.baseHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw KeldraError.http(String(err), err);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw KeldraError.api(response.status, extractErrorMessage(text));
    }

    return response.json() as Promise<T>;
  }
}
