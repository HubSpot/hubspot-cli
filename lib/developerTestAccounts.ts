import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { uiLogger } from './ui/logger.js';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

import { lib } from '../lang/en.js';
import { uiAccountDescription } from './ui/index.js';
import { logError } from './errorHandlers/index.js';
import { FetchDeveloperTestAccountsResponse } from '@hubspot/local-dev-lib/types/developerTestAccounts.js';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

export function getHasDevTestAccounts(
  appDeveloperAccountConfig: HubSpotConfigAccount
): boolean {
  const parentPortalId = appDeveloperAccountConfig.accountId;
  const accountsList = getAllConfigAccounts();

  if (!accountsList) {
    return false;
  }

  for (const portal of accountsList) {
    if (
      Boolean(portal.parentAccountId) &&
      portal.parentAccountId === parentPortalId &&
      portal.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
    ) {
      return true;
    }
  }
  return false;
}

export async function validateDevTestAccountUsageLimits(
  accountConfig: HubSpotConfigAccount
): Promise<FetchDeveloperTestAccountsResponse | null> {
  const accountId = accountConfig.accountId;

  if (!accountId) {
    return null;
  }

  const { data } = await fetchDeveloperTestAccounts(accountId);

  if (!data) {
    return null;
  }

  const limit = data.maxTestPortals;
  const count = data.results.length;
  if (count >= limit) {
    const hasDevTestAccounts = getHasDevTestAccounts(accountConfig);
    if (hasDevTestAccounts) {
      throw new Error(
        lib.developerTestAccount.create.failure.alreadyInConfig(
          accountConfig.name || accountId,
          limit
        )
      );
    } else {
      throw new Error(
        lib.developerTestAccount.create.failure.limit(
          accountConfig.name || accountId,
          limit
        )
      );
    }
  }
  return data;
}

export function handleDeveloperTestAccountCreateError(
  err: unknown,
  accountId: number,
  env: Environment,
  portalLimit: number
): never {
  if (isMissingScopeError(err)) {
    uiLogger.error(lib.developerTestAccount.create.failure.scopes.message);
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    uiLogger.info(
      lib.developerTestAccount.create.failure.scopes.instructions(
        uiAccountDescription(accountId),
        url
      )
    );
  } else if (
    isSpecifiedError(err, {
      statusCode: 400,
      errorType: 'TEST_PORTAL_LIMIT_REACHED',
    })
  ) {
    uiLogger.log('');
    uiLogger.error(
      lib.developerTestAccount.create.failure.limit(
        uiAccountDescription(accountId),
        portalLimit
      )
    );
    uiLogger.log('');
  } else {
    logError(err);
  }
  throw err;
}
