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
const { buildSandbox } = require('../../lib/sandboxCreate');
const { uiFeatureHighlight, uiAccountDescription } = require('../../lib/ui');
const {
  sandboxTypeMap,
  getAvailableSyncTypes,
  syncTypes,
  validateSandboxUsageLimits,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  trackCommandUsage,
  trackCommandMetadataUsage,
} = require('../../lib/usageTracking');
const {
  sandboxTypePrompt,
  sandboxNamePrompt,
} = require('../../lib/prompts/sandboxesPrompt');
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

const i18nKey = 'cli.commands.sandbox.subcommands.create';

exports.command = 'create [--name] [--type]';
exports.describe = i18n(`${i18nKey}.describe`);

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
        i18n('cli.lib.sandbox.create.failure.scopes.message', {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n('cli.lib.sandbox.create.failure.scopes.instructions', {
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
      namePrompt = await sandboxNamePrompt(sandboxType);
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.name`));
      process.exit(EXIT_CODES.ERROR);
    }
  }
  const sandboxName = name || namePrompt.name;

  let sandboxSyncPromptResult = true;
  let contactRecordsSyncPromptResult = true;
  if (!force) {
    const syncI18nKey = 'cli.lib.sandbox.sync';
    const sandboxLangKey =
      sandboxType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
        ? 'developer'
        : 'standard';
    const { sandboxSyncPrompt } = await promptUser([
      {
        name: 'sandboxSyncPrompt',
        type: 'confirm',
        message: i18n(`${syncI18nKey}.confirm.createFlow.${sandboxLangKey}`, {
          parentAccountName: uiAccountDescription(accountId),
          sandboxName,
        }),
      },
    ]);
    sandboxSyncPromptResult = sandboxSyncPrompt;
    // We can prompt for contact records before fetching types since we're starting with a fresh sandbox in create
    if (sandboxSyncPrompt) {
      const { contactRecordsSyncPrompt } = await promptUser([
        {
          name: 'contactRecordsSyncPrompt',
          type: 'confirm',
          message: i18n(
            `${syncI18nKey}.confirm.syncContactRecords.${sandboxLangKey}`
          ),
        },
      ]);
      contactRecordsSyncPromptResult = contactRecordsSyncPrompt;
    }
  }

  try {
    const { result } = await buildSandbox({
      name: sandboxName,
      type: sandboxType,
      accountConfig,
      env,
      force,
    });

    // Prompt user to sync assets after sandbox creation
    const sandboxAccountConfig = getAccountConfig(result.sandbox.sandboxHubId);
    const handleSyncSandbox = async syncTasks => {
      // Send tracking event for secondary action, in this case a sandbox sync within the sandbox create flow
      trackCommandMetadataUsage(
        'sandbox-sync',
        { step: 'sandbox-create' },
        result.sandbox.sandboxHubId
      );
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
      if (!force) {
        if (sandboxSyncPromptResult) {
          await handleSyncSandbox(availableSyncTasks);
        }
      } else {
        await handleSyncSandbox(availableSyncTasks);
      }
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

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
