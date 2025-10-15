import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import { fetchTypes } from '@hubspot/local-dev-lib/api/sandboxSync';
import { getAccountId, getConfigAccounts } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { AccountType, CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

import { uiLogger } from './ui/logger.js';
import { lib } from '../lang/en.js';
import { logError } from './errorHandlers/index.js';
import { SandboxSyncTask, SandboxAccountType } from '../types/Sandboxes.js';
import { uiAccountDescription } from './ui/index.js';

export const SYNC_TYPES = {
  OBJECT_RECORDS: 'object-records',
} as const;

export const SANDBOX_TYPE_MAP: { [key: string]: SandboxAccountType } = {
  dev: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  developer: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  development: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  standard: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
};

export const SANDBOX_API_TYPE_MAP = {
  [HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX]: 1,
  [HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX]: 2,
} as const;

export const SANDBOX_TYPE_MAP_V2 = {
  [HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX]: 'STANDARD',
  [HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX]: 'DEVELOPER',
} as const;

export function getSandboxTypeAsString(accountType?: AccountType): string {
  if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
    return 'development'; // Only place we're using this specific name
  }
  return 'standard';
}

export function getHasSandboxesByType(
  parentAccountConfig: CLIAccount,
  type: AccountType
): boolean {
  const id = getAccountIdentifier(parentAccountConfig);
  const parentPortalId = getAccountId(id);
  const accountsList = getConfigAccounts() || [];

  for (const portal of accountsList) {
    if (
      (portal.parentAccountId !== null ||
        portal.parentAccountId !== undefined) &&
      portal.parentAccountId === parentPortalId &&
      portal.accountType &&
      portal.accountType === type
    ) {
      return true;
    }
  }
  return false;
}

// Fetches available sync types for a given sandbox portal
export async function getAvailableSyncTypes(
  parentAccountConfig: CLIAccount,
  config: CLIAccount
): Promise<Array<SandboxSyncTask>> {
  const parentId = getAccountIdentifier(parentAccountConfig);
  const parentPortalId = getAccountId(parentId);
  const id = getAccountIdentifier(config);
  const portalId = getAccountId(id);

  if (!parentPortalId || !portalId) {
    throw new Error(lib.sandbox.sync.failure.syncTypeFetch);
  }

  const {
    data: { results: syncTypes },
  } = await fetchTypes(parentPortalId, portalId);
  if (!syncTypes) {
    throw new Error(lib.sandbox.sync.failure.syncTypeFetch);
  }
  return syncTypes.map(t => ({ type: t.name }));
}

export async function validateSandboxUsageLimits(
  accountConfig: CLIAccount,
  sandboxType: AccountType,
  env: Environment
): Promise<void> {
  const id = getAccountIdentifier(accountConfig);
  const accountId = getAccountId(id);

  if (!accountId) {
    throw new Error(lib.sandbox.create.failure.usageLimitsFetch);
  }

  const {
    data: { usage },
  } = await getSandboxUsageLimits(accountId);
  if (!usage) {
    throw new Error(lib.sandbox.create.failure.usageLimitsFetch);
  }
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
    if (usage['DEVELOPER'].available === 0) {
      const devSandboxLimit = usage['DEVELOPER'].limit;
      const hasDevelopmentSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
      );
      if (hasDevelopmentSandboxes) {
        throw new Error(
          lib.sandbox.create.developer.failure.alreadyInConfig(
            accountId,
            devSandboxLimit
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          lib.sandbox.create.developer.failure.limit(
            accountId,
            devSandboxLimit,
            `${baseUrl}/sandboxes-developer/${accountId}/development`
          )
        );
      }
    }
  }
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
    if (usage['STANDARD'].available === 0) {
      const standardSandboxLimit = usage['STANDARD'].limit;
      const hasStandardSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
      );
      if (hasStandardSandboxes) {
        throw new Error(
          lib.sandbox.create.standard.failure.alreadyInConfig(
            accountId,
            standardSandboxLimit
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          lib.sandbox.create.standard.failure.limit(
            accountId,
            standardSandboxLimit,
            `${baseUrl}/sandboxes-developer/${accountId}/standard`
          )
        );
      }
    }
  }
}

export function handleSandboxCreateError(
  err: unknown,
  env: Environment,
  name: string,
  accountId: number
): never {
  if (isMissingScopeError(err)) {
    uiLogger.error(lib.sandbox.create.failure.scopes.message);
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    uiLogger.info(
      lib.sandbox.create.failure.scopes.instructions(
        uiAccountDescription(accountId),
        url
      )
    );
  } else if (
    isSpecifiedError(err, {
      statusCode: 403,
      category: 'BANNED',
      subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
    })
  ) {
    uiLogger.log('');
    uiLogger.error(lib.sandbox.create.failure.invalidUser(name, accountId));
    uiLogger.log('');
  } else if (
    isSpecifiedError(err, {
      statusCode: 403,
      category: 'BANNED',
      subCategory: 'SandboxErrors.DEVELOPMENT_SANDBOX_ACCESS_NOT_ALLOWED',
    })
  ) {
    uiLogger.log('');
    uiLogger.error(lib.sandbox.create.failure['403Gating'](name, accountId));
    uiLogger.log('');
  } else {
    logError(err);
  }
  throw err;
}
