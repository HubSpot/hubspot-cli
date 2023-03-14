const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const Spinnies = require('spinnies');
const { initiateSync } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { uiLine } = require('../../lib/ui');
const {
  getAccountName,
  getAvailableSyncTypes,
  pollSyncTaskStatus,
} = require('../../lib/sandboxes');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');

const i18nKey = 'cli.commands.sandbox.subcommands.sync';

exports.command = 'sync';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { force } = options; // For scripting purposes
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });

  trackCommandUsage('sandbox-sync', null, accountId);

  if (
    // Check if default account is a sandbox, otherwise exit
    // sandboxAccountType is null for non-sandbox portals, and one of 'DEVELOPER' or 'STANDARD' for sandbox portals. Undefined is to handle older config entries.
    accountConfig.sandboxAccountType === undefined ||
    accountConfig.sandboxAccountType === null
  ) {
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);

    logger.error(i18n(`${i18nKey}.failure.notSandbox`));

    process.exit(EXIT_CODES.ERROR);
  }

  // Verify parent account exists in the config
  let parentAccountId = accountConfig.parentAccountId || undefined;
  if (!parentAccountId || !getAccountId({ account: parentAccountId })) {
    logger.log('');
    logger.error(
      i18n(`${i18nKey}.failure.missingParentPortal`, {
        sandboxName: getAccountName(accountConfig),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const parentAccountConfig = getAccountConfig(parentAccountId);
  const isDevelopmentSandbox = accountConfig.sandboxAccountType === 'DEVELOPER';
  const isStandardSandbox = accountConfig.sandboxAccountType === 'STANDARD';

  if (isDevelopmentSandbox) {
    logger.log(i18n(`${i18nKey}.info.developmentSandbox`));
    logger.log(
      i18n(`${i18nKey}.info.sync`, {
        parentAccountName: getAccountName(parentAccountConfig),
        sandboxName: getAccountName(accountConfig),
      })
    );
    uiLine();
    logger.warn(i18n(`${i18nKey}.warning.developmentSandbox`));
    uiLine();
    logger.log('');

    if (!force) {
      // Skip confirmation if force flag is present.
      const { confirmSandboxSyncPrompt: confirmed } = await promptUser([
        {
          name: 'confirmSandboxSyncPrompt',
          type: 'confirm',
          message: i18n(`${i18nKey}.confirm.developmentSandbox`, {
            parentAccountName: getAccountName(parentAccountConfig),
            sandboxName: getAccountName(accountConfig),
          }),
        },
      ]);
      if (!confirmed) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }
  } else if (isStandardSandbox) {
    const standardSyncUrl = `${getHubSpotWebsiteOrigin(
      getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
    )}/sandboxes-developer/${parentAccountId}/sync?step=select_sync_path&id=${parentAccountId}_${accountId}`;

    logger.log(
      i18n(`${i18nKey}.info.standardSandbox`, {
        url: standardSyncUrl,
      })
    );
    logger.log(
      i18n(`${i18nKey}.info.sync`, {
        parentAccountName: getAccountName(parentAccountConfig),
        sandboxName: getAccountName(accountConfig),
      })
    );
    uiLine();
    logger.warn(i18n(`${i18nKey}.warning.standardSandbox`));
    uiLine();
    logger.log('');

    if (!force) {
      // Skip confirmation if force flag is present.
      const { confirmSandboxSyncPrompt: confirmed } = await promptUser([
        {
          name: 'confirmSandboxSyncPrompt',
          type: 'confirm',
          message: i18n(`${i18nKey}.confirm.standardSandbox`, {
            parentAccountName: getAccountName(parentAccountConfig),
            sandboxName: getAccountName(accountConfig),
          }),
        },
      ]);
      if (!confirmed) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }
  } else {
    logger.error('Sync must be run in a sandbox account.');
    process.exit(EXIT_CODES.ERROR);
  }

  let initiateSyncResponse;

  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
  const syncStatusUrl = `${baseUrl}/sandboxes-developer/${parentAccountId}/${
    isDevelopmentSandbox ? 'developer' : 'standard'
  }`;

  try {
    logger.log('');
    spinnies.add('sandboxSync', {
      text: i18n(`${i18nKey}.loading.startSync`),
    });

    // Fetches sync types based on default account. Parent account required for fetch
    const tasks = await getAvailableSyncTypes(
      parentAccountConfig,
      accountConfig
    );

    initiateSyncResponse = await initiateSync(
      parentAccountId,
      accountId,
      tasks,
      accountId
    );

    logger.log(i18n(`${i18nKey}.info.earlyExit`));
    logger.log('');
    spinnies.succeed('sandboxSync', {
      text: i18n(`${i18nKey}.loading.succeed`),
    });
  } catch (err) {
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);

    spinnies.fail('sandboxSync', {
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
      isSpecifiedError(
        err,
        429,
        'RATE_LIMITS',
        'sandboxes-sync-api.SYNC_IN_PROGRESS'
      )
    ) {
      logger.error(
        i18n(`${i18nKey}.failure.syncInProgress`, {
          url: `${baseUrl}/sandboxes-developer/${parentAccountId}/syncactivitylog`,
        })
      );
    } else if (
      isSpecifiedError(
        err,
        403,
        'BANNED',
        'sandboxes-sync-api.SYNC_NOT_ALLOWED_INVALID_USERID'
      )
    ) {
      // This will only trigger if a user is not a super admin of the target account.
      logger.error(
        i18n(`${i18nKey}.failure.notSuperAdmin`, {
          account: getAccountName(accountConfig),
        })
      );
    } else if (
      isSpecifiedError(
        err,
        404,
        'OBJECT_NOT_FOUND',
        'SandboxErrors.SANDBOX_NOT_FOUND'
      )
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

    process.exit(EXIT_CODES.ERROR);
  }

  try {
    logger.log('');
    logger.log('Sync progress:');
    // Poll sync task status to show progress bars
    await pollSyncTaskStatus(
      parentAccountId,
      initiateSyncResponse.id,
      syncStatusUrl
    );

    logger.log('');
    spinnies.add('syncComplete', {
      text: i18n(`${i18nKey}.polling.syncing`),
    });
    spinnies.succeed('syncComplete', {
      text: i18n(`${i18nKey}.polling.succeed`),
    });
    logger.log('');
    logger.log(
      i18n(`${i18nKey}.info.syncStatus`, {
        url: syncStatusUrl,
      })
    );

    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    // If polling fails at this point, we do not track a failed sync since it is running in the background.
    logErrorInstance(err);

    spinnies.add('syncComplete', {
      text: i18n(`${i18nKey}.polling.syncing`),
    });
    spinnies.fail('syncComplete', {
      text: i18n(`${i18nKey}.polling.fail`, {
        url: syncStatusUrl,
      }),
    });

    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('f', {
    type: 'boolean',
    alias: 'force',
    describe: i18n(`${i18nKey}.examples.force`),
  });

  yargs.example([['$0 sandbox sync', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
