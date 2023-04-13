const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { uiLine } = require('../../lib/ui');
const {
  getAccountName,
  sandboxTypeMap,
  DEVELOPER_SANDBOX,
  STANDARD_SANDBOX,
} = require('../../lib/sandboxes');
const { syncSandbox } = require('../../lib/sandbox-sync');

const i18nKey = 'cli.commands.sandbox.subcommands.sync';

exports.command = 'sync';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { force } = options; // For scripting purposes
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  trackCommandUsage('sandbox-sync', null, accountId);

  if (
    // Check if default account is a sandbox, otherwise exit
    // sandboxAccountType is null for non-sandbox portals, and one of 'DEVELOPER' or 'STANDARD' for sandbox portals. Undefined is to handle older config entries.
    accountConfig.sandboxAccountType === undefined ||
    accountConfig.sandboxAccountType === null
  ) {
    logger.error(i18n(`${i18nKey}.failure.notSandbox`));
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);
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
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);
    process.exit(EXIT_CODES.ERROR);
  }

  const parentAccountConfig = getAccountConfig(parentAccountId);
  const isDevelopmentSandbox =
    sandboxTypeMap[accountConfig.sandboxAccountType] === DEVELOPER_SANDBOX;
  const isStandardSandbox =
    sandboxTypeMap[accountConfig.sandboxAccountType] === STANDARD_SANDBOX;

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
        trackCommandUsage('sandbox-sync', { successful: false }, accountId);
        process.exit(EXIT_CODES.SUCCESS);
      }
    }
  } else if (isStandardSandbox) {
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
        trackCommandUsage('sandbox-sync', { successful: false }, accountId);
        process.exit(EXIT_CODES.SUCCESS);
      }
    }
  } else {
    logger.error('Sync must be run in a sandbox account.');
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await syncSandbox({
      accountConfig,
      parentAccountConfig,
      env,
      allowEarlyTermination: true,
    });
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);
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
