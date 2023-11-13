const SpinniesManager = require('./SpinniesManager');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');
const { i18n } = require('./lang');
const {
  getAvailableSyncTypes,
  pollSyncTaskStatus,
  getAccountName,
  DEVELOPER_SANDBOX,
  sandboxTypeMap,
  syncTypes,
} = require('./sandboxes');
const { initiateSync } = require('@hubspot/local-dev-lib/sandboxes');
const {
  debugErrorAndContext,
  logErrorInstance,
} = require('./errorHandlers/standardErrors');
const {
  isSpecifiedError,
  isMissingScopeError,
} = require('./errorHandlers/apiErrors');
const { getSandboxTypeAsString } = require('./sandboxes');
const { getAccountId } = require('@hubspot/local-dev-lib/config');
const { uiAccountDescription } = require('./ui');

const i18nKey = 'cli.lib.sandbox.sync';

/**
 * @param {Object} accountConfig - Account config of sandbox portal
 * @param {Object} parentAccountConfig - Account config of parent portal
 * @param {String} env - Environment (QA/Prod)
 * @param {Array} syncTasks - Array of available sync tasks
 * @param {Boolean} allowEarlyTermination - Option to allow a keypress to terminate early
 * @param {Boolean} skipPolling - Option to skip progress bars for polling and let sync run in background
 * @returns
 */
const syncSandbox = async ({
  accountConfig,
  parentAccountConfig,
  env,
  syncTasks,
  allowEarlyTermination = true,
  skipPolling = false,
}) => {
  const accountId = getAccountId(accountConfig.portalId);
  const parentAccountId = getAccountId(parentAccountConfig.portalId);
  SpinniesManager.init({
    succeedColor: 'white',
  });
  let initiateSyncResponse;
  let availableSyncTasks = syncTasks;

  const baseUrl = getHubSpotWebsiteOrigin(env);
  const syncStatusUrl = `${baseUrl}/sandboxes-developer/${parentAccountId}/${getSandboxTypeAsString(
    accountConfig.sandboxAccountType
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

    initiateSyncResponse = await initiateSync(
      parentAccountId,
      accountId,
      availableSyncTasks,
      accountId
    );

    if (allowEarlyTermination) {
      logger.log(i18n(`${i18nKey}.info.earlyExit`));
    }
    SpinniesManager.succeed('sandboxSync', {
      text: i18n(`${i18nKey}.loading.succeed`, {
        accountName: uiAccountDescription(accountId),
      }),
    });
    if (
      skipPolling &&
      sandboxTypeMap[accountConfig.sandboxAccountType] === DEVELOPER_SANDBOX
    ) {
      if (syncTasks.some(t => t.type === syncTypes.OBJECT_RECORDS)) {
        logger.log(i18n(`${i18nKey}.loading.skipPollingWithContacts`));
      } else {
        logger.log(i18n(`${i18nKey}.loading.skipPolling`));
      }
      logger.log('');
    }
  } catch (err) {
    debugErrorAndContext(err);

    SpinniesManager.fail('sandboxSync', {
      text: i18n(`${i18nKey}.loading.fail`),
    });

    logger.log('');
    if (isMissingScopeError(err)) {
      logger.error(
        i18n(`${i18nKey}.failure.missingScopes`, {
          accountName: getAccountName(parentAccountConfig),
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'sandboxes-sync-api.SYNC_NOT_ALLOWED_INVALID_USER',
      })
    ) {
      logger.error(
        i18n(`${i18nKey}.failure.invalidUser`, {
          accountName: uiAccountDescription(accountId),
          parentAccountName: getAccountName(parentAccountConfig),
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
          account: getAccountName(accountConfig),
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
          account: getAccountName(accountConfig),
        })
      );
    } else {
      logErrorInstance(err);
    }
    logger.log('');
    throw err;
  }

  if (!skipPolling) {
    try {
      logger.log('');
      logger.log('Sync progress:');
      // Poll sync task status to show progress bars
      await pollSyncTaskStatus(
        parentAccountId,
        initiateSyncResponse.id,
        syncStatusUrl,
        allowEarlyTermination
      );

      logger.log('');
      SpinniesManager.add('syncComplete', {
        text: i18n(`${i18nKey}.polling.syncing`),
      });
      SpinniesManager.succeed('syncComplete', {
        text: i18n(`${i18nKey}.polling.succeed`),
      });
      logger.log('');
      logger.log(
        i18n(`${i18nKey}.info.syncStatus`, {
          url: syncStatusUrl,
        })
      );
    } catch (err) {
      // If polling fails at this point, we do not track a failed sync since it is running in the background.
      logErrorInstance(err);

      SpinniesManager.add('syncComplete', {
        text: i18n(`${i18nKey}.polling.syncing`),
      });
      SpinniesManager.fail('syncComplete', {
        text: i18n(`${i18nKey}.polling.fail`, {
          url: syncStatusUrl,
        }),
      });

      throw err;
    }
  }
};

module.exports = {
  syncSandbox,
};
