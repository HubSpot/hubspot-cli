import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

import { i18n } from './lang';
import { uiAccountDescription } from './ui';
import { logError } from './errorHandlers/index';
import { FetchDeveloperTestAccountsResponse } from '@hubspot/local-dev-lib/types/developerTestAccounts';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

export function getHasDevTestAccounts(
  appDeveloperAccount: HubSpotConfigAccount
): boolean {
  const parentAccountId = appDeveloperAccount.accountId;
  const accountsList = getAllConfigAccounts();

  if (!accountsList) {
    return false;
  }

  for (const account of accountsList) {
    if (
      Boolean(account.parentAccountId) &&
      account.parentAccountId === parentAccountId &&
      account.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
    ) {
      return true;
    }
  }
  return false;
}

export async function validateDevTestAccountUsageLimits(
  account: HubSpotConfigAccount
): Promise<FetchDeveloperTestAccountsResponse | null> {
  const accountId = account.accountId;

  const { data } = await fetchDeveloperTestAccounts(accountId);

  if (!data) {
    return null;
  }

  const limit = data.maxTestPortals;
  const count = data.results.length;
  if (count >= limit) {
    const hasDevTestAccounts = getHasDevTestAccounts(account);
    if (hasDevTestAccounts) {
      throw new Error(
        i18n('lib.developerTestAccount.create.failure.alreadyInConfig', {
          accountName: account.name,
          limit,
        })
      );
    } else {
      throw new Error(
        i18n('lib.developerTestAccount.create.failure.limit', {
          accountName: account.name,
          limit,
        })
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
    logger.error(
      i18n('lib.developerTestAccount.create.failure.scopes.message', {
        accountName: uiAccountDescription(accountId),
      })
    );
    const websiteOrigin = getHubSpotWebsiteOrigin(env);
    const url = `${websiteOrigin}/personal-access-key/${accountId}`;
    logger.info(
      i18n('lib.developerTestAccount.create.failure.scopes.instructions', {
        accountName: uiAccountDescription(accountId),
        url,
      })
    );
  } else if (
    isSpecifiedError(err, {
      statusCode: 400,
      errorType: 'TEST_PORTAL_LIMIT_REACHED',
    })
  ) {
    logger.log('');
    logger.error(
      i18n('lib.developerTestAccount.create.failure.limit', {
        accountName: uiAccountDescription(accountId),
        limit: portalLimit,
      })
    );
    logger.log('');
  } else {
    logError(err);
  }
  throw err;
}
