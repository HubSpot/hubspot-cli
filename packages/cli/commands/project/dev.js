const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const {
  trackCommandUsage,
  trackCommandMetadataUsage,
} = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { handleExit } = require('../../lib/process');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getConfigAccounts,
  getAccountConfig,
  getEnv,
} = require('@hubspot/local-dev-lib/config');
const {
  createProject,
  fetchProject,
} = require('@hubspot/local-dev-lib/api/projects');
const {
  getProjectConfig,
  ensureProjectExists,
  handleProjectUpload,
  pollProjectBuildAndDeploy,
  validateProjectConfig,
} = require('../../lib/projects');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  uiAccountDescription,
  uiBetaTag,
  uiCommandReference,
  uiLine,
} = require('../../lib/ui');
const { confirmPrompt } = require('../../lib/prompts/promptUtils');
const {
  selectTargetAccountPrompt,
  confirmDefaultAccountPrompt,
} = require('../../lib/prompts/projectDevTargetAccountPrompt');
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const LocalDevManager = require('../../lib/LocalDevManager');
const { isSandbox, getSandboxTypeAsString } = require('../../lib/sandboxes');
const { sandboxNamePrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  validateSandboxUsageLimits,
  getAvailableSyncTypes,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const {
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  PROJECT_ERROR_TYPES,
} = require('../../lib/constants');

const { buildSandbox } = require('../../lib/sandboxCreate');
const { syncSandbox } = require('../../lib/sandboxSync');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/local-dev-lib/errors/apiErrors');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const {
  isDeveloperTestAccount,
  isAppDeveloperAccount,
  validateDevTestAccountUsageLimits,
} = require('../../lib/developerTestAccounts');
const {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');
const {
  developerTestAccountNamePrompt,
} = require('../../lib/prompts/developerTestAccountNamePrompt');
const {
  buildDeveloperTestAccount,
} = require('../../lib/developerTestAccountCreate');

const i18nKey = 'cli.commands.project.subcommands.dev';

exports.command = 'dev [--account]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  trackCommandUsage('project-dev', null, accountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  uiBetaTag(i18n(`${i18nKey}.logs.betaMessage`));

  if (!projectConfig) {
    logger.error(i18n(`${i18nKey}.errors.noProjectConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  validateProjectConfig(projectConfig, projectDir);

  const accounts = getConfigAccounts();
  let targetAccountId = options.account ? accountId : null;
  let createNewSandbox = false;
  let createNewDeveloperTestAccount = false;
  const defaultAccountIsSandbox = isSandbox(accountConfig);
  const defaultAccountIsDeveloperTestAccount = isDeveloperTestAccount(
    accountConfig
  );

  if (
    !targetAccountId &&
    (defaultAccountIsSandbox || defaultAccountIsDeveloperTestAccount)
  ) {
    logger.log();
    const useDefaultAccount = await confirmDefaultAccountPrompt(
      accountConfig.name,
      defaultAccountIsSandbox
        ? `${getSandboxTypeAsString(accountConfig.accountType)} sandbox`
        : HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST]
    );

    if (useDefaultAccount) {
      targetAccountId = accountId;
    } else {
      logger.log(
        i18n(`${i18nKey}.logs.declineDefaultAccountExplanation`, {
          useCommand: uiCommandReference('hs accounts use'),
          devCommand: uiCommandReference('hs project dev'),
        })
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  if (!targetAccountId) {
    logger.log();
    uiLine();
    if (isAppDeveloperAccount(accountConfig)) {
      logger.warn(i18n(`${i18nKey}.logs.nonDeveloperTestAccountWarning`));
    } else {
      logger.warn(i18n(`${i18nKey}.logs.nonSandboxWarning`));
    }
    uiLine();
    logger.log();

    const {
      targetAccountId: promptTargetAccountId,
      createNewSandbox: promptCreateNewSandbox,
      createNewDeveloperTestAccount: promptCreateNewDeveloperTestAccount,
    } = await selectTargetAccountPrompt(accounts, accountConfig);

    targetAccountId = promptTargetAccountId;
    createNewSandbox = promptCreateNewSandbox;
    createNewDeveloperTestAccount = promptCreateNewDeveloperTestAccount;
  }

  if (createNewSandbox) {
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

      targetAccountId = result.sandbox.sandboxHubId;

      const sandboxAccountConfig = getAccountConfig(
        result.sandbox.sandboxHubId
      );
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
    } catch (err) {
      logErrorInstance(err);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (createNewDeveloperTestAccount) {
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

      targetAccountId = result.id;
    } catch (err) {
      logErrorInstance(err);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  logger.log();
  const projectExists = await ensureProjectExists(
    targetAccountId,
    projectConfig.name,
    {
      allowCreate: false,
      noLogs: true,
      withPolling: createNewSandbox,
    }
  );

  let deployedBuild;
  let isGithubLinked;

  if (projectExists) {
    const project = await fetchProject(targetAccountId, projectConfig.name);
    deployedBuild = project.deployedBuild;
    isGithubLinked =
      project.sourceIntegration &&
      project.sourceIntegration.source === 'GITHUB';
  }

  SpinniesManager.init();

  if (!projectExists) {
    // Create the project without prompting if this is a newly created sandbox
    let shouldCreateProject = createNewSandbox;

    if (!shouldCreateProject) {
      logger.log();
      uiLine();
      logger.warn(
        i18n(`${i18nKey}.logs.projectMustExistExplanation`, {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        })
      );
      uiLine();

      shouldCreateProject = await confirmPrompt(
        i18n(`${i18nKey}.prompt.createProject`, {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        })
      );
    }

    if (shouldCreateProject) {
      SpinniesManager.add('createProject', {
        text: i18n(`${i18nKey}.status.creatingProject`, {
          accountIdentifier: uiAccountDescription(targetAccountId),
          projectName: projectConfig.name,
        }),
      });

      try {
        await createProject(targetAccountId, projectConfig.name);
        SpinniesManager.succeed('createProject', {
          text: i18n(`${i18nKey}.status.createdProject`, {
            accountIdentifier: uiAccountDescription(targetAccountId),
            projectName: projectConfig.name,
          }),
          succeedColor: 'white',
        });
      } catch (err) {
        SpinniesManager.fail('createProject');
        logger.log(i18n(`${i18nKey}.status.failedToCreateProject`));
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      // We cannot continue if the project does not exist in the target account
      logger.log();
      logger.log(i18n(`${i18nKey}.logs.choseNotToCreateProject`));
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  let initialUploadResult;

  // Create an initial build if the project was newly created in the account
  if (!projectExists) {
    initialUploadResult = await handleProjectUpload(
      targetAccountId,
      projectConfig,
      projectDir,
      (...args) => pollProjectBuildAndDeploy(...args, true),
      i18n(`${i18nKey}.logs.initialUploadMessage`)
    );

    if (initialUploadResult.uploadError) {
      if (
        isSpecifiedError(initialUploadResult.uploadError, {
          subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
        })
      ) {
        logger.log();
        logger.error(i18n(`${i18nKey}.errors.projectLockedError`));
        logger.log();
      } else {
        logApiErrorInstance(
          initialUploadResult.uploadError,
          new ApiErrorContext({
            accountId,
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

    deployedBuild = initialUploadResult.buildResult;
  }

  const LocalDev = new LocalDevManager({
    debug: options.debug,
    deployedBuild,
    projectConfig,
    projectDir,
    targetAccountId,
    isGithubLinked,
  });

  await LocalDev.start();

  handleExit(({ isSIGHUP }) => LocalDev.stop(!isSIGHUP));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
