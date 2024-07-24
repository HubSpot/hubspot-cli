const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/index');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { getAccountConfig, getEnv } = require('@hubspot/local-dev-lib/config');
const { createProject } = require('@hubspot/local-dev-lib/api/projects');
const {
  ENVIRONMENTS,
} = require('@hubspot/local-dev-lib/constants/environments');
const {
  confirmDefaultAccountPrompt,
  selectSandboxTargetAccountPrompt,
  selectDeveloperTestTargetAccountPrompt,
  confirmUseExistingDeveloperTestAccountPrompt,
} = require('./prompts/projectDevTargetAccountPrompt');
const { confirmPrompt } = require('./prompts/promptUtils');
const {
  validateSandboxUsageLimits,
  getAvailableSyncTypes,
} = require('./sandboxes');
const { syncSandbox } = require('./sandboxSync');
const {
  validateDevTestAccountUsageLimits,
} = require('./developerTestAccounts');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { uiCommandReference, uiLine, uiAccountDescription } = require('./ui');
const SpinniesManager = require('./ui/SpinniesManager');
const { i18n } = require('./lang');
const { EXIT_CODES } = require('./enums/exitCodes');
const { trackCommandMetadataUsage } = require('./usageTracking');
const {
  isAppDeveloperAccount,
  isDeveloperTestAccount,
} = require('./accountTypes');
const {
  handleProjectUpload,
  pollProjectBuildAndDeploy,
} = require('./projects');
const {
  PROJECT_ERROR_TYPES,
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
} = require('./constants');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('./errorHandlers/apiErrors');
const {
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/local-dev-lib/constants/auth');
const { buildNewAccount, saveAccountToConfig } = require('./buildAccount');
const { hubspotAccountNamePrompt } = require('./prompts/accountNamePrompt');

const i18nKey = 'lib.localDev';

// If the user passed in the --account flag, confirm they want to use that account as
// their target account, otherwise exit
const confirmDefaultAccountIsTarget = async accountConfig => {
  logger.log();
  const useDefaultAccount = await confirmDefaultAccountPrompt(
    accountConfig.name,
    HUBSPOT_ACCOUNT_TYPE_STRINGS[accountConfig.accountType]
  );

  if (!useDefaultAccount) {
    logger.log(
      i18n(
        `${i18nKey}.confirmDefaultAccountIsTarget.declineDefaultAccountExplanation`,
        {
          useCommand: uiCommandReference('hs accounts use'),
          devCommand: uiCommandReference('hs project dev'),
        }
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
};

// Confirm the default account is a developer account if developing public apps
const checkIfAppDeveloperAccount = accountConfig => {
  if (!isAppDeveloperAccount(accountConfig)) {
    logger.error(i18n(`${i18nKey}.checkIfAppDevloperAccount`));
    process.exit(EXIT_CODES.SUCCESS);
  }
};

// Confirm the default account is a developer account if developing public apps
const checkIfDeveloperTestAccount = accountConfig => {
  if (!isDeveloperTestAccount(accountConfig)) {
    logger.error(i18n(`${i18nKey}.checkIfDeveloperTestAccount`));
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
    logger.log(
      i18n(
        `${i18nKey}.suggestRecommendedNestedAccount.publicAppNonDeveloperTestAccountWarning`
      )
    );
  } else if (isAppDeveloperAccount(accountConfig)) {
    logger.error(
      i18n(
        `${i18nKey}.suggestRecommendedNestedAccount.privateAppInAppDeveloperAccountError`
      )
    );
    process.exit(EXIT_CODES.ERROR);
  } else {
    logger.log(
      i18n(`${i18nKey}.suggestRecommendedNestedAccount.nonSandboxWarning`)
    );
  }
  uiLine();
  logger.log();

  const targetAccountPrompt = isAppDeveloperAccount(accountConfig)
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
  try {
    const { name } = await hubspotAccountNamePrompt({
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
    });

    trackCommandMetadataUsage(
      'sandbox-create',
      { step: 'project-dev' },
      accountId
    );

    const { result } = await buildNewAccount({
      name,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
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

// Create a developer test account and return its accountId
const createDeveloperTestAccountForLocalDev = async (
  accountId,
  accountConfig,
  env
) => {
  let currentPortalCount = 0;
  let maxTestPortals = 10;
  try {
    const validateResult = await validateDevTestAccountUsageLimits(
      accountConfig
    );
    if (validateResult) {
      currentPortalCount = validateResult.results
        ? validateResult.results.length
        : 0;
      maxTestPortals = validateResult.maxTestPortals;
    }
  } catch (err) {
    if (isMissingScopeError(err)) {
      logger.error(
        i18n('lib.developerTestAccount.create.failure.scopes.message', {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n('lib.developerTestAccount.create.failure.scopes.instructions', {
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
    const { name } = await hubspotAccountNamePrompt({
      currentPortalCount,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
    });
    trackCommandMetadataUsage(
      'developer-test-account-create',
      { step: 'project-dev' },
      accountId
    );

    const { result } = await buildNewAccount({
      name,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
      accountConfig,
      env,
      portalLimit: maxTestPortals,
    });

    return result.id;
  } catch (err) {
    logErrorInstance(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

// Prompt user to confirm usage of an existing developer test account that is not currently in the config
const useExistingDevTestAccount = async (env, account) => {
  const useExistingDevTestAcct = await confirmUseExistingDeveloperTestAccountPrompt(
    account
  );
  if (!useExistingDevTestAcct) {
    logger.log('');
    logger.log(
      i18n(
        `${i18nKey}.confirmDefaultAccountIsTarget.declineDefaultAccountExplanation`,
        {
          useCommand: uiCommandReference('hs accounts use'),
          devCommand: uiCommandReference('hs project dev'),
        }
      )
    );
    logger.log('');
    process.exit(EXIT_CODES.SUCCESS);
  }
  const devTestAcctConfigName = await saveAccountToConfig({
    env,
    accountName: account.accountName,
    accountId: account.id,
  });
  logger.success(
    i18n(`lib.developerTestAccount.create.success.configFileUpdated`, {
      accountName: devTestAcctConfigName,
      authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
    })
  );
};

// Prompt the user to create a new project if one doesn't exist on their target account
const createNewProjectForLocalDev = async (
  projectConfig,
  targetAccountId,
  shouldCreateWithoutConfirmation,
  hasPublicApps
) => {
  // Create the project without prompting if this is a newly created sandbox
  let shouldCreateProject = shouldCreateWithoutConfirmation;

  if (!shouldCreateProject) {
    const explanationString = i18n(
      hasPublicApps
        ? `${i18nKey}.createNewProjectForLocalDev.publicAppProjectMustExistExplanation`
        : `${i18nKey}.createNewProjectForLocalDev.projectMustExistExplanation`,
      {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      }
    );
    logger.log();
    uiLine();
    logger.log(explanationString);
    uiLine();

    shouldCreateProject = await confirmPrompt(
      i18n(`${i18nKey}.createNewProjectForLocalDev.createProject`, {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      })
    );
  }

  if (shouldCreateProject) {
    SpinniesManager.add('createProject', {
      text: i18n(`${i18nKey}.createNewProjectForLocalDev.creatingProject`, {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      }),
    });

    try {
      const project = await createProject(targetAccountId, projectConfig.name);
      SpinniesManager.succeed('createProject', {
        text: i18n(`${i18nKey}.createNewProjectForLocalDev.createdProject`, {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        }),
        succeedColor: 'white',
      });
      return project;
    } catch (err) {
      SpinniesManager.fail('createProject');
      logger.log(
        i18n(`${i18nKey}.createNewProjectForLocalDev.failedToCreateProject`)
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    // We cannot continue if the project does not exist in the target account
    logger.log();
    logger.log(
      i18n(`${i18nKey}.createNewProjectForLocalDev.choseNotToCreateProject`)
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
};

// Create an initial build if the project was newly created in the account
// Return the newly deployed build
const createInitialBuildForNewProject = async (
  projectConfig,
  projectDir,
  targetAccountId
) => {
  const initialUploadResult = await handleProjectUpload(
    targetAccountId,
    projectConfig,
    projectDir,
    (...args) => pollProjectBuildAndDeploy(...args, true),
    i18n(`${i18nKey}.createInitialBuildForNewProject.initialUploadMessage`)
  );

  if (initialUploadResult.uploadError) {
    if (
      isSpecifiedError(initialUploadResult.uploadError, {
        subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
      })
    ) {
      logger.log();
      logger.error(
        i18n(`${i18nKey}.createInitialBuildForNewProject.projectLockedError`)
      );
      logger.log();
    } else {
      logApiErrorInstance(
        initialUploadResult.uploadError,
        new ApiErrorContext({
          accountId: targetAccountId,
          projectName: projectConfig.name,
        })
      );
    }
    process.exit(EXIT_CODES.ERROR);
  }

  if (!initialUploadResult.succeeded) {
    let subTasks = [];

    if (initialUploadResult.buildResult.status === 'FAILURE') {
      subTasks =
        initialUploadResult.buildResult[PROJECT_BUILD_TEXT.SUBTASK_KEY];
    } else if (initialUploadResult.deployResult.status === 'FAILURE') {
      subTasks =
        initialUploadResult.deployResult[PROJECT_DEPLOY_TEXT.SUBTASK_KEY];
    }

    const failedSubTasks = subTasks.filter(task => task.status === 'FAILURE');

    logger.log();
    failedSubTasks.forEach(failedSubTask => {
      logger.error(failedSubTask.errorMessage);
    });
    logger.log();

    process.exit(EXIT_CODES.ERROR);
  }

  return initialUploadResult.buildResult;
};

const getAccountHomeUrl = accountId => {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );
  return `${baseUrl}/home?portalId=${accountId}`;
};

module.exports = {
  confirmDefaultAccountIsTarget,
  checkIfAppDeveloperAccount,
  checkIfDeveloperTestAccount,
  suggestRecommendedNestedAccount,
  createSandboxForLocalDev,
  createDeveloperTestAccountForLocalDev,
  useExistingDevTestAccount,
  createNewProjectForLocalDev,
  createInitialBuildForNewProject,
  getAccountHomeUrl,
};
