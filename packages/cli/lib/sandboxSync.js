const SpinniesManager = require('./ui/SpinniesManager');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { i18n } = require('./lang');
const { getAvailableSyncTypes } = require('./sandboxes');
const { initiateSync } = require('@hubspot/local-dev-lib/sandboxes');
const { debugErrorAndContext } = require('./errorHandlers/standardErrors');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('./errorHandlers/apiErrors');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/apiErrors');
const { getSandboxTypeAsString } = require('./sandboxes');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const {
  getAccountIdentifier,
} = require('@hubspot/local-dev-lib/config/getAccountIdentifier');
const {
  uiAccountDescription,
  uiLine,
  uiLink,
  uiCommandDisabledBanner,
} = require('./ui');
const { isDevelopmentSandbox } = require('./accountTypes');

const i18nKey = 'lib.sandbox.sync';

/**
 * @param {Object} accountConfig - Account config of sandbox portal
 * @param {Object} parentAccountConfig - Account config of parent portal
 * @param {String} env - Environment (QA/Prod)
 * @param {Array} syncTasks - Array of available sync tasks
 * @returns
 */
const syncSandbox = async ({
  accountConfig,
  parentAccountConfig,
  env,
  syncTasks,
  slimInfoMessage = false,
}) => {
  const id = getAccountIdentifier(accountConfig);
  const accountId = getAccountId(id);
  const parentId = getAccountIdentifier(parentAccountConfig);
  const parentAccountId = getAccountId(parentId);
  const isDevSandbox = isDevelopmentSandbox(accountConfig);
  SpinniesManager.init({
    succeedColor: 'white',
  });
  let availableSyncTasks = syncTasks;

  const baseUrl = getHubSpotWebsiteOrigin(env);
  const syncStatusUrl = `${baseUrl}/sandboxes-developer/${parentAccountId}/${getSandboxTypeAsString(
    accountConfig.accountType
  )}`;

  try {
    // If no sync tasks exist, fetch sync types based on default account. Parent account required for fetch
    if (
      !availableSyncTasks ||
      (typeof availableSyncTasks === 'object' &&
        availableSyncTasks.length === 0)
    ) {
      availableSyncTasks = await getAvailableSyncTypes(
        parentAccountConfig,
        accountConfig
      );
    }

    SpinniesManager.add('sandboxSync', {
      text: i18n(`${i18nKey}.loading.startSync`),
    });

    await initiateSync(
      parentAccountId,
      accountId,
      availableSyncTasks,
      accountId
    );
    let spinniesText = isDevSandbox
      ? `${i18nKey}.loading.succeedDevSb`
      : `${i18nKey}.loading.succeed`;
    SpinniesManager.succeed('sandboxSync', {
      text: i18n(
        slimInfoMessage ? `${i18nKey}.loading.successDevSbInfo` : spinniesText,
        {
          accountName: uiAccountDescription(accountId),
          url: uiLink(
            i18n(`${i18nKey}.info.syncStatusDetailsLinkText`),
            syncStatusUrl
          ),
        }
      ),
    });
  } catch (err) {
    debugErrorAndContext(err);

    SpinniesManager.fail('sandboxSync', {
      text: i18n(`${i18nKey}.loading.fail`),
    });

    logger.log('');
    if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'sandboxes-sync-api.SYNC_NOT_ALLOWED_INVALID_USER',
      })
    ) {
      logger.error(
        i18n(`${i18nKey}.failure.invalidUser`, {
          accountName: uiAccountDescription(accountId),
          parentAccountName: uiAccountDescription(parentAccountId),
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 429,
        category: 'RATE_LIMITS',
        subCategory: 'sandboxes-sync-api.SYNC_IN_PROGRESS',
      })
    ) {
      logger.error(
        i18n(`${i18nKey}.failure.syncInProgress`, {
          url: `${baseUrl}/sandboxes-developer/${parentAccountId}/syncactivitylog`,
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'sandboxes-sync-api.SYNC_NOT_ALLOWED_INVALID_USERID',
      })
    ) {
      // This will only trigger if a user is not a super admin of the target account.
      logger.error(
        i18n(`${i18nKey}.failure.notSuperAdmin`, {
          account: uiAccountDescription(accountId),
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 404,
        category: 'OBJECT_NOT_FOUND',
        subCategory: 'SandboxErrors.SANDBOX_NOT_FOUND',
      })
    ) {
      logger.error(
        i18n(`${i18nKey}.failure.objectNotFound`, {
          account: uiAccountDescription(accountId),
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 404,
      })
    ) {
      uiCommandDisabledBanner(
        'hs sandbox sync',
        'https://app.hubspot.com/l/docs/guides/crm/project-cli-commands#developer-projects-cli-commands-beta'
      );
    } else {
      logApiErrorInstance(
        err,
        new ApiErrorContext({
          accountId: parentAccountId,
          request: 'sandbox sync',
        })
      );
    }
    logger.log('');
    throw err;
  }

  if (!slimInfoMessage) {
    logger.log();
    uiLine();
    logger.info(
      i18n(
        `${i18nKey}.info.${isDevSandbox ? 'syncMessageDevSb' : 'syncMessage'}`,
        {
          url: uiLink(
            i18n(`${i18nKey}.info.syncStatusDetailsLinkText`),
            syncStatusUrl
          ),
        }
      )
    );
    uiLine();
    logger.log();
  }
};

module.exports = {
  syncSandbox,
};
