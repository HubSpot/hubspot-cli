const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/local-dev-lib/config');
const { uiFeatureHighlight, uiBetaTag } = require('../../lib/ui');
const {
  sandboxTypeMap,
  getAvailableSyncTypes,
  syncTypes,
  validateSandboxUsageLimits,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { sandboxTypePrompt } = require('../../lib/prompts/sandboxesPrompt');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { syncSandbox } = require('../../lib/sandboxSync');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const {
  isMissingScopeError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const { buildNewAccount } = require('../../lib/buildAccount');
const {
  hubspotAccountNamePrompt,
} = require('../../lib/prompts/accountNamePrompt');

const i18nKey = 'commands.sandbox.subcommands.create';

exports.command = 'create [--name] [--type]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name, type, force } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  trackCommandUsage('sandbox-create', null, accountId);

  // Default account is not a production portal
  if (
    accountConfig.accountType &&
    accountConfig.accountType !== HUBSPOT_ACCOUNT_TYPES.STANDARD
  ) {
    logger.error(
      i18n(`${i18nKey}.failure.invalidAccountType`, {
        accountType:
          HUBSPOT_ACCOUNT_TYPE_STRINGS[
            HUBSPOT_ACCOUNT_TYPES[accountConfig.accountType]
          ],
        accountName: accountConfig.name,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let typePrompt;
  let namePrompt;

  if ((type && !sandboxTypeMap[type.toLowerCase()]) || !type) {
    if (!force) {
      typePrompt = await sandboxTypePrompt();
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.type`));
      process.exit(EXIT_CODES.ERROR);
    }
  }
  const sandboxType = type
    ? sandboxTypeMap[type.toLowerCase()]
    : typePrompt.type;

  // Check usage limits and exit if parent portal has no available sandboxes for the selected type
  try {
    await validateSandboxUsageLimits(accountConfig, sandboxType, env);
  } catch (err) {
    if (isMissingScopeError(err)) {
      logger.error(
        i18n('lib.sandbox.create.failure.scopes.message', {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n('lib.sandbox.create.failure.scopes.instructions', {
          accountName: accountConfig.name || accountId,
          url,
        })
      );
    } else {
      logErrorInstance(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }

  if (!name) {
    if (!force) {
      namePrompt = await hubspotAccountNamePrompt({ accountType: sandboxType });
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.name`));
      process.exit(EXIT_CODES.ERROR);
    }
  }
  const sandboxName = name || namePrompt.name;

  let contactRecordsSyncPromptResult = false;
  if (!force) {
    const isDevelopmentSandbox =
      sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX;
    const syncI18nKey = 'lib.sandbox.sync';

    // Prompt to sync contact records for standard sandboxes only
    if (!isDevelopmentSandbox) {
      const { contactRecordsSyncPrompt } = await promptUser([
        {
          name: 'contactRecordsSyncPrompt',
          type: 'confirm',
          message: i18n(`${syncI18nKey}.confirm.syncContactRecords.standard`),
        },
      ]);
      contactRecordsSyncPromptResult = contactRecordsSyncPrompt;
    }
  }

  try {
    const { result } = await buildNewAccount({
      name: sandboxName,
      accountType: sandboxType,
      accountConfig,
      env,
      force,
    });

    const sandboxAccountConfig = getAccountConfig(result.sandbox.sandboxHubId);
    const handleSyncSandbox = async syncTasks => {
      await syncSandbox({
        accountConfig: sandboxAccountConfig,
        parentAccountConfig: accountConfig,
        env,
        syncTasks,
      });
    };
    try {
      let availableSyncTasks = await getAvailableSyncTypes(
        accountConfig,
        sandboxAccountConfig
      );

      if (!contactRecordsSyncPromptResult) {
        availableSyncTasks = availableSyncTasks.filter(
          t => t.type !== syncTypes.OBJECT_RECORDS
        );
      }
      await handleSyncSandbox(availableSyncTasks);
    } catch (err) {
      logErrorInstance(err);
      throw err;
    }

    const highlightItems = ['accountsUseCommand', 'projectCreateCommand'];
    if (sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX) {
      highlightItems.push('projectDevCommand');
    } else {
      highlightItems.push('projectUploadCommand');
    }

    uiFeatureHighlight(highlightItems);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    // Errors are logged in util functions
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('f', {
    type: 'boolean',
    alias: 'force',
    describe: i18n(`${i18nKey}.examples.force`),
  });
  yargs.option('name', {
    describe: i18n(`${i18nKey}.options.name.describe`),
    type: 'string',
  });
  yargs.option('type', {
    describe: i18n(`${i18nKey}.options.type.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 sandbox create --name=MySandboxAccount --type=STANDARD',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  return yargs;
};
