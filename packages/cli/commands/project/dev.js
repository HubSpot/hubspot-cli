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
const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfigAccounts,
  getAccountConfig,
  getEnv,
} = require('@hubspot/local-dev-lib/config');
const { createProject, fetchProject } = require('@hubspot/cli-lib/api/dfs');
const {
  getProjectConfig,
  ensureProjectExists,
  handleProjectUpload,
  pollProjectBuildAndDeploy,
  showPlatformVersionWarning,
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
  confirmDefaultSandboxAccountPrompt,
} = require('../../lib/prompts/projectDevTargetAccountPrompt');
const SpinniesManager = require('../../lib/SpinniesManager');
const LocalDevManager = require('../../lib/LocalDevManager');
const { isSandbox } = require('../../lib/sandboxes');
const { sandboxNamePrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  validateSandboxUsageLimits,
  DEVELOPER_SANDBOX,
  getAvailableSyncTypes,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');
const {
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  ERROR_TYPES,
} = require('@hubspot/cli-lib/lib/constants');

const { buildSandbox } = require('../../lib/sandbox-create');
const { syncSandbox } = require('../../lib/sandbox-sync');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  logApiErrorInstance,
  ApiErrorContext,
  isMissingScopeError,
  isSpecifiedError,
} = require('../../lib/errorHandlers/apiErrors');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');

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
  const defaultAccountIsSandbox = isSandbox(accountConfig);

  if (!targetAccountId && defaultAccountIsSandbox) {
    logger.log();
    const useDefaultSandboxAccount = await confirmDefaultSandboxAccountPrompt(
      accountConfig.name,
      accountConfig.sandboxAccountType
    );

    if (useDefaultSandboxAccount) {
      targetAccountId = accountId;
    } else {
      logger.log(
        i18n(`${i18nKey}.logs.declineDefaultSandboxExplanation`, {
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
    logger.warn(i18n(`${i18nKey}.logs.nonSandboxWarning`));
    uiLine();
    logger.log();

    const {
      targetAccountId: promptTargetAccountId,
      createNewSandbox: promptCreateNewSandbox,
    } = await selectTargetAccountPrompt(accounts, accountConfig);

    targetAccountId = promptTargetAccountId;
    createNewSandbox = promptCreateNewSandbox;
  }

  if (createNewSandbox) {
    try {
      await validateSandboxUsageLimits(accountConfig, DEVELOPER_SANDBOX, env);
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
      const { name } = await sandboxNamePrompt(DEVELOPER_SANDBOX);

      trackCommandMetadataUsage(
        'sandbox-create',
        { step: 'project-dev' },
        accountId
      );

      const { result } = await buildSandbox({
        name,
        type: DEVELOPER_SANDBOX,
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
      await showPlatformVersionWarning(accountId, projectConfig);

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
          subCategory: ERROR_TYPES.PROJECT_LOCKED,
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
