import { vi } from 'vitest';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
type MockErrorResponse = {
  status: number;
  data: {
    message?: string;
    errorType?: string;
    category?: string;
    subCategory?: string;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockHubSpotHttpResponse<T>(data?: any): HubSpotPromise<T> {
  return Promise.resolve({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {
      headers: {},
    },
  }) as HubSpotPromise<T>;
}

export function mockHubSpotHttpError(
  message: string,
  response: MockErrorResponse
): HubSpotHttpError {
  return new HubSpotHttpError(message, {
    cause: { isAxiosError: true, response },
  });
}

// Stubs the color-detection env to a color-capable interactive baseline.
// Call vi.unstubAllEnvs() in afterEach to restore.
export function stubColorEnv(): void {
  [
    'CI',
    'NO_COLOR',
    'COLOR',
    'FORCE_COLOR',
    'COLORTERM',
    'TERM_PROGRAM',
  ].forEach(key => vi.stubEnv(key, undefined));
  vi.stubEnv('TERM', 'xterm-256color');
}
