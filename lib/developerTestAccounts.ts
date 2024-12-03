import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { getAccountId, getConfigAccounts } from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { fetchDeveloperTestAccounts } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import {
  isMissingScopeError,
  isSpecifiedError,
} from '@hubspot/local-dev-lib/errors/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';

import { i18n } from './lang';
import { uiAccountDescription } from './ui';
import { logError } from './errorHandlers/index';
import { FetchDeveloperTestAccountsResponse } from '@hubspot/local-dev-lib/types/developerTestAccounts';
import { Environment } from '@hubspot/local-dev-lib/types/Config';

function getHasDevTestAccounts(appDeveloperAccountConfig: CLIAccount): boolean {
  const id = getAccountIdentifier(appDeveloperAccountConfig);
  const parentPortalId = getAccountId(id);
  const accountsList = getConfigAccounts();

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
  accountConfig: CLIAccount
): Promise<FetchDeveloperTestAccountsResponse | null> {
  const id = getAccountIdentifier(accountConfig);
  const accountId = getAccountId(id);

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
        i18n('lib.developerTestAccount.create.failure.alreadyInConfig', {
          accountName: accountConfig.name || accountId,
          limit,
        })
      );
    } else {
      throw new Error(
        i18n('lib.developerTestAccount.create.failure.limit', {
          accountName: accountConfig.name || accountId,
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
