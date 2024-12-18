// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
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
const { logError } = require('../../lib/errorHandlers/index');
const { isMissingScopeError } = require('@hubspot/local-dev-lib/errors/index');
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

exports.command = 'create';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const { name, type, force, derivedAccountId } = options;
  const accountConfig = getAccountConfig(derivedAccountId);
  const env = getValidEnv(getEnv(derivedAccountId));

  trackCommandUsage('sandbox-create', null, derivedAccountId);

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
          accountName: accountConfig.name || derivedAccountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${derivedAccountId}`;
      logger.info(
        i18n('lib.sandbox.create.failure.scopes.instructions', {
          accountName: accountConfig.name || derivedAccountId,
          url,
        })
      );
    } else {
      logError(err);
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
    const isStandardSandbox =
      sandboxType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX;

    // Prompt to sync contact records for standard sandboxes only
    if (isStandardSandbox) {
      const { contactRecordsSyncPrompt } = await promptUser([
        {
          name: 'contactRecordsSyncPrompt',
          type: 'confirm',
          message: i18n('lib.sandbox.sync.confirm.syncContactRecords.standard'),
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
    // For v1 sandboxes, keep sync here. Once we migrate to v2, this will be handled by BE automatically
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
      logError(err);
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
  yargs.option('force', {
    type: 'boolean',
    alias: 'f',
    describe: i18n(`${i18nKey}.options.force.describe`),
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
