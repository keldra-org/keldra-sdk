import { vi } from 'vitest';

export interface MockResponse {
  status?: number;
  body?: unknown;
  text?: string;
}

/**
 * Install a mock for globalThis.fetch that returns configured responses.
 * Call .mockRestore() to clean up.
 */
export function mockFetch(responses: MockResponse[]) {
  let callIndex = 0;

  const mock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    const status = resp.status ?? 200;
    const ok = status >= 200 && status < 300;
    const bodyText =
      resp.text ?? (resp.body ? JSON.stringify(resp.body) : '');

    return {
      ok,
      status,
      text: async () => bodyText,
      json: async () => (resp.body !== undefined ? resp.body : JSON.parse(bodyText)),
    } as Response;
  });

  vi.stubGlobal('fetch', mock);
  return mock;
}
