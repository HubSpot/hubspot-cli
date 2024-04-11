const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { createProject } = require('@hubspot/local-dev-lib/api/projects');

const {
  confirmDefaultAccountPrompt,
  selectSandboxTargetAccountPrompt,
  selectDeveloperTestTargetAccountPrompt,
} = require('./prompts/projectDevTargetAccountPrompt');
const { sandboxNamePrompt } = require('./prompts/sandboxesPrompt');
const {
  developerTestAccountNamePrompt,
} = require('./prompts/developerTestAccountNamePrompt');
const { confirmPrompt } = require('./prompts/promptUtils');
const {
  validateSandboxUsageLimits,
  getSandboxTypeAsString,
  getAvailableSyncTypes,
} = require('./sandboxes');
const { buildSandbox } = require('./sandboxCreate');
const { syncSandbox } = require('./sandboxSync');
const {
  validateDevTestAccountUsageLimits,
} = require('./developerTestAccounts');
const { buildDeveloperTestAccount } = require('./developerTestAccountCreate');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { uiCommandReference, uiLine, uiAccountDescription } = require('./ui');
const SpinniesManager = require('./ui/SpinniesManager');
const { i18n } = require('./lang');
const { EXIT_CODES } = require('./enums/exitCodes');
const { trackCommandMetadataUsage } = require('./usageTracking');
const { isAppDeveloperAccount } = require('./accountTypes');
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

const i18nKey = 'cli.lib.localDev';

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

// Confirm the default account supports the creation of the recommended nested account type
// Exit if not
const checkCorrectParentAccountType = (accountConfig, hasPublicApps) => {
  if (hasPublicApps && !isAppDeveloperAccount(accountConfig)) {
    logger.error(
      i18n(
        `${i18nKey}.checkCorrectParentAccountType.standardAccountNotSupported`
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  }
  if (!hasPublicApps && isAppDeveloperAccount(accountConfig)) {
    logger.error(
      i18n(
        `${i18nKey}.checkCorrectParentAccountType.appDeveloperAccountNotSupported`
      )
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
    logger.warn(
      i18n(
        `${i18nKey}.suggestRecommendedNestedAccount.nonDeveloperTestAccountWarning`
      )
    );
  } else {
    logger.warn(
      i18n(`${i18nKey}.suggestRecommendedNestedAccount.nonSandboxWarning`)
    );
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
        i18n('cli.lib.developerTestAccount.create.failure.scopes.message', {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n(
          'cli.lib.developerTestAccount.create.failure.scopes.instructions',
          {
            accountName: accountConfig.name || accountId,
            url,
          }
        )
      );
    } else {
      logErrorInstance(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    const { name } = await developerTestAccountNamePrompt(currentPortalCount);
    trackCommandMetadataUsage(
      'developer-test-account-create',
      { step: 'project-dev' },
      accountId
    );

    const { result } = await buildDeveloperTestAccount({
      name,
      accountConfig,
      env,
      maxTestPortals,
    });

    return result.id;
  } catch (err) {
    logErrorInstance(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

// Prompt the user to create a new project if one doesn't exist on their target account
const createNewProjectForLocalDev = async (
  projectConfig,
  targetAccountId,
  shouldCreateWithoutConfirmation
) => {
  // Create the project without prompting if this is a newly created sandbox
  let shouldCreateProject = shouldCreateWithoutConfirmation;

  if (!shouldCreateProject) {
    logger.log();
    uiLine();
    logger.warn(
      i18n(
        `${i18nKey}.createNewProjectForLocalDev.projectMustExistExplanation`,
        {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        }
      )
    );
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
      await createProject(targetAccountId, projectConfig.name);
      SpinniesManager.succeed('createProject', {
        text: i18n(`${i18nKey}.createNewProjectForLocalDev.createdProject`, {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        }),
        succeedColor: 'white',
      });
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
      console.error(failedSubTask.errorMessage);
    });
    logger.log();

    process.exit(EXIT_CODES.ERROR);
  }

  return initialUploadResult.buildResult;
};

module.exports = {
  confirmDefaultAccountIsTarget,
  checkCorrectParentAccountType,
  suggestRecommendedNestedAccount,
  createSandboxForLocalDev,
  createDeveloperTestAccountForLocalDev,
  createNewProjectForLocalDev,
  createInitialBuildForNewProject,
};
