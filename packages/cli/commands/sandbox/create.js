const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { buildSandbox } = require('../../lib/sandbox-create');
const { uiFeatureHighlight } = require('../../lib/ui');
const {
  sandboxTypeMap,
  DEVELOPER_SANDBOX,
  getSandboxTypeAsString,
  getAccountName,
  getAvailableSyncTypes,
  syncTypes,
  validateSandboxUsageLimits,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/cli-lib/lib/environment');
const { logger } = require('@hubspot/cli-lib/logger');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  sandboxTypePrompt,
  sandboxNamePrompt,
  developmentSandboxNamePrompt,
} = require('../../lib/prompts/sandboxesPrompt');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { syncSandbox } = require('../../lib/sandbox-sync');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');

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
    accountConfig.sandboxAccountType &&
    accountConfig.sandboxAccountType !== null
  ) {
    trackCommandUsage('sandbox-create', { successful: false }, accountId);
    logger.error(
      i18n(`${i18nKey}.failure.creatingWithinSandbox`, {
        sandboxType: getSandboxTypeAsString(accountConfig.sandboxAccountType),
        sandboxName: accountConfig.name,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let typePrompt;
  let namePrompt;

  if ((type && !sandboxTypeMap[type]) || !type) {
    if (!force) {
      typePrompt = await sandboxTypePrompt();
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.type`));
      trackCommandUsage('sandbox-create', { successful: false }, accountId);
      process.exit(EXIT_CODES.ERROR);
    }
  }
  const sandboxType = sandboxTypeMap[type] || sandboxTypeMap[typePrompt.type];

  // Check usage limits and exit if parent portal has no available sandboxes for the selected type
  try {
    await validateSandboxUsageLimits(accountConfig, sandboxType, env);
  } catch (err) {
    logErrorInstance(err);
    trackCommandUsage('sandbox-create', { successful: false }, accountId);
    process.exit(EXIT_CODES.ERROR);
  }

  if (!name) {
    if (!force) {
      if (sandboxType === DEVELOPER_SANDBOX) {
        namePrompt = await developmentSandboxNamePrompt();
      } else {
        namePrompt = await sandboxNamePrompt();
      }
    } else {
      logger.error(i18n(`${i18nKey}.failure.optionMissing.name`));
      trackCommandUsage('sandbox-create', { successful: false }, accountId);
      process.exit(EXIT_CODES.ERROR);
    }
  }
  const sandboxName = name || namePrompt.name;

  let sandboxSyncPromptResult = true;
  let contactRecordsSyncPromptResult = true;
  if (!force) {
    const syncI18nKey = 'cli.lib.sandbox.sync';
    const { sandboxSyncPrompt } = await promptUser([
      {
        name: 'sandboxSyncPrompt',
        type: 'confirm',
        message: i18n(`${syncI18nKey}.confirm.createFlow.${sandboxType}`, {
          parentAccountName: getAccountName(accountConfig),
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
            `${syncI18nKey}.confirm.syncContactRecords.${sandboxType}`
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

    uiFeatureHighlight([
      'accountsUseCommand',
      sandboxType === DEVELOPER_SANDBOX
        ? 'projectDevCommand'
        : 'projectUploadCommand',
    ]);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    trackCommandUsage('sandbox-create', { successful: false }, accountId);
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
