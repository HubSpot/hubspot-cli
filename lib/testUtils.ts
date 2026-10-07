import { vi } from 'vitest';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  ACCOUNT_TARGET_CATEGORIES,
  ACCOUNT_TARGET_SELECTION_SOURCES,
  AccountTargetCandidate,
} from '../types/AccountTargets.js';
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

export const MOCK_SANDBOX_TARGET: AccountTargetCandidate = {
  accountId: 222,
  accountName: 'Sandbox',
  source: ACCOUNT_TARGET_SELECTION_SOURCES.GLOBAL_DEFAULT,
  category: ACCOUNT_TARGET_CATEGORIES.RECOMMENDED_TESTING,
};

export const MOCK_PRODUCTION_TARGET: AccountTargetCandidate = {
  accountId: 111,
  accountName: 'Prod Portal',
  source: ACCOUNT_TARGET_SELECTION_SOURCES.GLOBAL_DEFAULT,
  category: ACCOUNT_TARGET_CATEGORIES.PRODUCTION_WITH_CARE,
};

// A getConfigAccountIfExists stand-in that knows only MOCK_PRODUCTION_TARGET.
export function getMockConfigAccount(
  identifier: number | string
): HubSpotConfigAccount | undefined {
  if (identifier !== MOCK_PRODUCTION_TARGET.accountId) {
    return undefined;
  }
  return {
    accountId: MOCK_PRODUCTION_TARGET.accountId,
    name: MOCK_PRODUCTION_TARGET.accountName,
    accountType: 'STANDARD',
  } as HubSpotConfigAccount;
}
