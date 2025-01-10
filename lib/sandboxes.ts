import { logger } from '@hubspot/local-dev-lib/logger';
import { getSandboxUsageLimits } from '@hubspot/local-dev-lib/api/sandboxHubs';
import { fetchTypes } from '@hubspot/local-dev-lib/api/sandboxSync';
import {
  getAccountId,
  getEnv,
  getConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';
import { AccountType, CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

import { i18n } from './lang';
import { uiAccountDescription } from './ui';
import { logError } from './errorHandlers/index';
import { SandboxSyncTask } from '../types/Sandboxes';

const i18nKey = 'lib.sandbox';

export const SYNC_TYPES = {
  OBJECT_RECORDS: 'object-records',
} as const;

export const SANDBOX_TYPE_MAP = {
  dev: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  developer: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  development: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  standard: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
} as const;

export const SANDBOX_API_TYPE_MAP = {
  [HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX]: 1,
  [HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX]: 2,
} as const;

export function getSandboxTypeAsString(accountType?: AccountType): string {
  if (accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
    return 'development'; // Only place we're using this specific name
  }
  return 'standard';
}

function getHasSandboxesByType(
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

class SandboxLimitError {
  context?: {
    limit?: string[];
  };
}

function getSandboxLimit(error: unknown): number {
  // Error context should contain a limit property with a list of one number. That number is the current limit

  if (error instanceof SandboxLimitError) {
    const limit =
      error.context && error.context.limit && error.context.limit[0];
    return limit ? parseInt(limit, 10) : 1; // Default to 1
  }
  return 1;
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
    throw new Error(i18n(`${i18nKey}.sync.failure.syncTypeFetch`));
  }

  const {
    data: { results: syncTypes },
  } = await fetchTypes(parentPortalId, portalId);
  if (!syncTypes) {
    throw new Error(i18n(`${i18nKey}.sync.failure.syncTypeFetch`));
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
    throw new Error(`${i18nKey}.create.failure.usageLimitFetch`);
  }

  const {
    data: { usage },
  } = await getSandboxUsageLimits(accountId);
  if (!usage) {
    throw new Error(`${i18nKey}.create.failure.usageLimitFetch`);
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
            `${i18nKey}.create.failure.alreadyInConfig.developer.${
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
            `${i18nKey}.create.failure.limit.developer.${
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
            `${i18nKey}.create.failure.alreadyInConfig.standard.${
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
            `${i18nKey}.create.failure.limit.standard.${
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
  accountConfig: CLIAccount,
  name: string,
  accountId: number
) {
  if (isMissingScopeError(err)) {
    logger.error(
      i18n(`${i18nKey}.create.failure.scopes.message`, {
        accountName: uiAccountDescription(accountId),
      })
    );
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    logger.info(
      i18n(`${i18nKey}.create.failure.scopes.instructions`, {
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
      i18n(`${i18nKey}.create.failure.invalidUser`, {
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
      i18n(`${i18nKey}.create.failure.403Gating`, {
        accountName: name,
        parentAccountName: uiAccountDescription(accountId),
        accountId,
      })
    );
    logger.log('');
  } else if (
    isSpecifiedError(err, {
      statusCode: 400,
      category: 'VALIDATION_ERROR',
      subCategory:
        'SandboxErrors.NUM_DEVELOPMENT_SANDBOXES_LIMIT_EXCEEDED_ERROR',
    }) &&
    'error' in err &&
    err.error instanceof Error
  ) {
    logger.log('');
    const devSandboxLimit = getSandboxLimit(err.error);
    const plural = devSandboxLimit !== 1;
    const hasDevelopmentSandboxes = getHasSandboxesByType(
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
    );
    if (hasDevelopmentSandboxes) {
      logger.error(
        i18n(
          `${i18nKey}.create.failure.alreadyInConfig.developer.${
            plural ? 'other' : 'one'
          }`,
          {
            accountName: uiAccountDescription(accountId),
            limit: devSandboxLimit,
          }
        )
      );
    } else {
      const baseUrl = getHubSpotWebsiteOrigin(getValidEnv(getEnv(accountId)));
      logger.error(
        i18n(
          `${i18nKey}.create.failure.limit.developer.${
            plural ? 'other' : 'one'
          }`,
          {
            accountName: uiAccountDescription(accountId),
            limit: devSandboxLimit,
            link: `${baseUrl}/sandboxes-developer/${accountId}/development`,
          }
        )
      );
    }
    logger.log('');
  } else if (
    isSpecifiedError(err, {
      statusCode: 400,
      category: 'VALIDATION_ERROR',
      subCategory: 'SandboxErrors.NUM_STANDARD_SANDBOXES_LIMIT_EXCEEDED_ERROR',
    }) &&
    'error' in err &&
    err.error instanceof Error
  ) {
    logger.log('');
    const standardSandboxLimit = getSandboxLimit(err.error);
    const plural = standardSandboxLimit !== 1;
    const hasStandardSandboxes = getHasSandboxesByType(
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
    );
    if (hasStandardSandboxes) {
      logger.error(
        i18n(
          `${i18nKey}.create.failure.alreadyInConfig.standard.${
            plural ? 'other' : 'one'
          }`,
          {
            accountName: uiAccountDescription(accountId),
            limit: standardSandboxLimit,
          }
        )
      );
    } else {
      const baseUrl = getHubSpotWebsiteOrigin(getValidEnv(getEnv(accountId)));
      logger.error(
        i18n(
          `${i18nKey}.create.failure.limit.standard.${
            plural ? 'other' : 'one'
          }`,
          {
            accountName: uiAccountDescription(accountId),
            limit: standardSandboxLimit,
            link: `${baseUrl}/sandboxes-developer/${accountId}/standard`,
          }
        )
      );
    }
    logger.log('');
  } else {
    logError(err);
  }
  throw err;
}
