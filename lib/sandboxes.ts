import { logger } from '@hubspot/local-dev-lib/logger';
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

import { i18n } from './lang.js';
import { uiAccountDescription } from './ui/index.js';
import { logError } from './errorHandlers/index.js';
import { SandboxSyncTask, SandboxAccountType } from '../types/Sandboxes.js';

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
    throw new Error(i18n(`lib.sandbox.sync.failure.syncTypeFetch`));
  }

  const {
    data: { results: syncTypes },
  } = await fetchTypes(parentPortalId, portalId);
  if (!syncTypes) {
    throw new Error(i18n(`lib.sandbox.sync.failure.syncTypeFetch`));
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
    throw new Error(i18n(`lib.sandbox.create.failure.usageLimitFetch`));
  }

  const {
    data: { usage },
  } = await getSandboxUsageLimits(accountId);
  if (!usage) {
    throw new Error(i18n(`lib.sandbox.create.failure.usageLimitFetch`));
  }
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
    if (usage['DEVELOPER'].available === 0) {
      const devSandboxLimit = usage['DEVELOPER'].limit;
      const plural = devSandboxLimit !== 1;
      const hasDevelopmentSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
      );
      if (hasDevelopmentSandboxes) {
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.alreadyInConfig.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.limit.developer.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: devSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/development`,
            }
          )
        );
      }
    }
  }
  if (sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX) {
    if (usage['STANDARD'].available === 0) {
      const standardSandboxLimit = usage['STANDARD'].limit;
      const plural = standardSandboxLimit !== 1;
      const hasStandardSandboxes = getHasSandboxesByType(
        accountConfig,
        HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
      );
      if (hasStandardSandboxes) {
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.alreadyInConfig.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: standardSandboxLimit,
            }
          )
        );
      } else {
        const baseUrl = getHubSpotWebsiteOrigin(env);
        throw new Error(
          i18n(
            `lib.sandbox.create.failure.limit.standard.${
              plural ? 'other' : 'one'
            }`,
            {
              accountName: accountConfig.name || accountId,
              limit: standardSandboxLimit,
              link: `${baseUrl}/sandboxes-developer/${accountId}/standard`,
            }
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
    logger.error(
      i18n(`lib.sandbox.create.failure.scopes.message`, {
        accountName: uiAccountDescription(accountId),
      })
    );
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    logger.info(
      i18n(`lib.sandbox.create.failure.scopes.instructions`, {
        accountName: uiAccountDescription(accountId),
        url,
      })
    );
  } else if (
    isSpecifiedError(err, {
      statusCode: 403,
      category: 'BANNED',
      subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
    })
  ) {
    logger.log('');
    logger.error(
      i18n(`lib.sandbox.create.failure.invalidUser`, {
        accountName: name,
        parentAccountName: uiAccountDescription(accountId),
      })
    );
    logger.log('');
  } else if (
    isSpecifiedError(err, {
      statusCode: 403,
      category: 'BANNED',
      subCategory: 'SandboxErrors.DEVELOPMENT_SANDBOX_ACCESS_NOT_ALLOWED',
    })
  ) {
    logger.log('');
    logger.error(
      i18n(`lib.sandbox.create.failure.403Gating`, {
        accountName: name,
        parentAccountName: uiAccountDescription(accountId),
        accountId,
      })
    );
    logger.log('');
  } else {
    logError(err);
  }
  throw err;
}
