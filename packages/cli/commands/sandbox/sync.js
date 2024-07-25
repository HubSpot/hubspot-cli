const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/local-dev-lib/config');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { uiLine, uiAccountDescription } = require('../../lib/ui');
const {
  isSandbox,
  isStandardSandbox,
  isDevelopmentSandbox,
} = require('../../lib/accountTypes');
const {
  getAvailableSyncTypes,
  getSyncTypesWithContactRecordsPrompt,
} = require('../../lib/sandboxes');
const { syncSandbox } = require('../../lib/sandboxSync');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/index');
const { logError } = require('../../lib/errorHandlers/index');
const {
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
  HUBSPOT_ACCOUNT_TYPES,
} = require('@hubspot/local-dev-lib/constants/config');

const i18nKey = 'commands.sandbox.subcommands.sync';

exports.command = 'sync';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { force } = options; // For scripting purposes
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  trackCommandUsage(
    'sandbox-sync',
    { type: accountConfig.accountType },
    accountId
  );

  if (
    // Check if default account is a sandbox, otherwise exit
    !isSandbox(accountConfig)
  ) {
    logger.error(
      i18n(`${i18nKey}.failure.invalidAccountType`, {
        accountType:
          HUBSPOT_ACCOUNT_TYPE_STRINGS[
            HUBSPOT_ACCOUNT_TYPES[accountConfig.accountType]
          ],
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  // Verify parent account exists in the config
  let parentAccountId = accountConfig.parentAccountId || undefined;
  if (!parentAccountId || !getAccountId({ account: parentAccountId })) {
    logger.log('');
    logger.error(
      i18n(`${i18nKey}.failure.missingParentPortal`, {
        sandboxName: uiAccountDescription(accountId),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const parentAccountConfig = getAccountConfig(parentAccountId);

  let availableSyncTasks;
  try {
    availableSyncTasks = await getAvailableSyncTypes(
      parentAccountConfig,
      accountConfig
    );
  } catch (error) {
    if (
      isSpecifiedError(error, {
        statusCode: 404,
        category: 'OBJECT_NOT_FOUND',
        subCategory: 'SandboxErrors.SANDBOX_NOT_FOUND',
      })
    ) {
      logger.error(
        i18n('lib.sandbox.sync.failure.objectNotFound', {
          account: uiAccountDescription(accountId),
        })
      );
    } else {
      logError(error);
    }
    process.exit(EXIT_CODES.ERROR);
  }

  if (isDevelopmentSandbox(accountConfig)) {
    logger.log(i18n(`${i18nKey}.info.developmentSandbox`));
    logger.log(
      i18n(`${i18nKey}.info.sync`, {
        parentAccountName: uiAccountDescription(parentAccountId),
        sandboxName: uiAccountDescription(accountId),
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
            parentAccountName: uiAccountDescription(parentAccountId),
            sandboxName: uiAccountDescription(accountId),
          }),
        },
      ]);
      if (!confirmed) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }
  } else if (isStandardSandbox(accountConfig)) {
    const standardSyncUrl = `${getHubSpotWebsiteOrigin(
      env
    )}/sandboxes-developer/${parentAccountId}/sync?step=select_sync_path&id=${parentAccountId}_${accountId}`;

    logger.log(
      i18n(`${i18nKey}.info.standardSandbox`, {
        url: standardSyncUrl,
      })
    );
    logger.log(
      i18n(`${i18nKey}.info.sync`, {
        parentAccountName: uiAccountDescription(parentAccountId),
        sandboxName: uiAccountDescription(accountId),
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
            parentAccountName: uiAccountDescription(parentAccountId),
            sandboxName: uiAccountDescription(accountId),
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

  try {
    const syncTasks = await getSyncTypesWithContactRecordsPrompt(
      accountConfig,
      availableSyncTasks,
      force
    );

    await syncSandbox({
      accountConfig,
      parentAccountConfig,
      env,
      syncTasks,
      allowEarlyTermination: true,
    });

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
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

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  return yargs;
};
