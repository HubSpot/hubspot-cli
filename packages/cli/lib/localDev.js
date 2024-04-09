const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const {
  isMissingScopeError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const {
  confirmDefaultAccountPrompt,
  selectSandboxTargetAccountPrompt,
  selectDeveloperTestTargetAccountPrompt,
} = require('./prompts/projectDevTargetAccountPrompt');
const { sandboxNamePrompt } = require('./prompts/sandboxesPrompt');
const {
  validateSandboxUsageLimits,
  getSandboxTypeAsString,
  getAvailableSyncTypes,
} = require('./sandboxes');
const { buildSandbox } = require('./lib/sandboxCreate');
const { syncSandbox } = require('./lib/sandboxSync');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { uiCommandReference, uiLine } = require('./ui');
const { i18n } = require('./lang');
const { EXIT_CODES } = require('./enums/exitCodes');
const { trackCommandMetadataUsage } = require('./lib/usageTracking');

// TODO: Maybe give these to their own lang key
const i18nKey = 'cli.commands.project.subcommands.dev';

// If the user passed in the --account flag, confirm they want to use that account as
// their target account, otherwise exit
const confirmDefaultAccountIsTarget = async (accountConfig, hasPublicApps) => {
  logger.log();
  const useDefaultAccount = await confirmDefaultAccountPrompt(
    accountConfig.name,
    hasPublicApps
      ? HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST]
      : `${getSandboxTypeAsString(accountConfig.accountType)} sandbox`
  );

  if (!useDefaultAccount) {
    logger.log(
      i18n(`${i18nKey}.logs.declineDefaultAccountExplanation`, {
        useCommand: uiCommandReference('hs accounts use'),
        devCommand: uiCommandReference('hs project dev'),
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
};

// If the user isn't using the recommended account type, prompt them to use or create one
const suggestRecommendedNestedAccount = async (
  accounts,
  accountConfig,
  hasPublicApps
) => {
  logger.log();
  uiLine();
  if (hasPublicApps) {
    logger.warn(i18n(`${i18nKey}.logs.nonDeveloperTestAccountWarning`));
  } else {
    logger.warn(i18n(`${i18nKey}.logs.nonSandboxWarning`));
  }
  uiLine();
  logger.log();

  const targetAccountPrompt = hasPublicApps
    ? selectDeveloperTestTargetAccountPrompt
    : selectSandboxTargetAccountPrompt;

  return targetAccountPrompt(accounts, accountConfig, hasPublicApps);
};

// Create a new sandbox and return its accountId
const createSandboxForLocalDev = async (accountId, accountConfig, env) => {
  try {
    await validateSandboxUsageLimits(
      accountConfig,
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      env
    );
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
  try {
    const { name } = await sandboxNamePrompt(
      HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX
    );

    trackCommandMetadataUsage(
      'sandbox-create',
      { step: 'project-dev' },
      accountId
    );

    const { result } = await buildSandbox({
      name,
      type: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      accountConfig,
      env,
    });

    const targetAccountId = result.sandbox.sandboxHubId;

    const sandboxAccountConfig = getAccountConfig(result.sandbox.sandboxHubId);
    const syncTasks = await getAvailableSyncTypes(
      accountConfig,
      sandboxAccountConfig
    );
    await syncSandbox({
      accountConfig: sandboxAccountConfig,
      parentAccountConfig: accountConfig,
      env,
      syncTasks,
      allowEarlyTermination: false, // Don't let user terminate early in this flow
      skipPolling: true, // Skip polling, sync will run and complete in the background
    });
    return targetAccountId;
  } catch (err) {
    logErrorInstance(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

module.exports = {
  confirmDefaultAccountIsTarget,
  suggestRecommendedNestedAccount,
  createSandboxForLocalDev,
};
