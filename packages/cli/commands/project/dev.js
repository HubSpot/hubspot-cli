const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { getConfigAccounts } = require('@hubspot/cli-lib/lib/config');
const { createProject, fetchProject } = require('@hubspot/cli-lib/api/dfs');
const { handleExit } = require('@hubspot/cli-lib/lib/process');
const {
  getProjectConfig,
  ensureProjectExists,
  handleProjectUpload,
  pollProjectBuildAndDeploy,
  showPlatformVersionWarning,
} = require('../../lib/projects');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiAccountDescription, uiBetaMessage, uiLine } = require('../../lib/ui');
const { confirmPrompt } = require('../../lib/prompts/promptUtils');
const {
  selectTargetAccountPrompt,
} = require('../../lib/prompts/projectDevTargetAccountPrompt');
const SpinniesManager = require('../../lib/SpinniesManager');
const {
  LocalDevManager,
  UPLOAD_PERMISSIONS,
} = require('../../lib/LocalDevManager');
const LocalDevManagerV2 = require('../../lib/LocalDevManagerV2');
const { isSandbox } = require('../../lib/sandboxes');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { sandboxNamePrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  validateSandboxUsageLimits,
  DEVELOPER_SANDBOX,
  getAvailableSyncTypes,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/cli-lib/lib/environment');
const {
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  ERROR_TYPES,
} = require('@hubspot/cli-lib/lib/constants');
const {
  logErrorInstance,
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { buildSandbox } = require('../../lib/sandbox-create');
const { syncSandbox } = require('../../lib/sandbox-sync');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  isMissingScopeError,
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');

const i18nKey = 'cli.commands.project.subcommands.dev';

exports.command = 'dev [--account]';
exports.describe = null; //i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  trackCommandUsage('project-dev', null, accountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  uiBetaMessage(i18n(`${i18nKey}.logs.betaMessage`));

  if (!projectConfig) {
    logger.error(i18n(`${i18nKey}.errors.noProjectConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  await showPlatformVersionWarning(accountId, projectConfig.platformVersion);

  const accounts = getConfigAccounts();
  let targetAccountId = options.account ? accountId : null;
  let createNewSandbox = false;
  const defaultAccountIsSandbox = isSandbox(accountConfig);

  if (!targetAccountId && defaultAccountIsSandbox) {
    targetAccountId = accountId;
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

  const projectExists = await ensureProjectExists(
    targetAccountId,
    projectConfig.name,
    {
      allowCreate: false,
      noLogs: true,
      withPolling: true,
    }
  );

  const isNonSandboxAccount =
    !defaultAccountIsSandbox && targetAccountId === accountId;

  let uploadPermission = isNonSandboxAccount
    ? UPLOAD_PERMISSIONS.manual
    : UPLOAD_PERMISSIONS.always;

  if (projectExists) {
    const { sourceIntegration } = await fetchProject(
      targetAccountId,
      projectConfig.name
    );
    if (options.extension || sourceIntegration) {
      uploadPermission = UPLOAD_PERMISSIONS.never;
    }
  }

  SpinniesManager.init();

  if (!projectExists) {
    // Create the project without prompting if this is a newly created sandbox
    let shouldCreateProject = createNewSandbox;

    if (!shouldCreateProject) {
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
      try {
        SpinniesManager.add('createProject', {
          text: i18n(`${i18nKey}.status.creatingProject`, {
            accountIdentifier: uiAccountDescription(targetAccountId),
            projectName: projectConfig.name,
          }),
        });
        await createProject(targetAccountId, projectConfig.name);
        SpinniesManager.succeed('createProject', {
          text: i18n(`${i18nKey}.status.createdProject`, {
            accountIdentifier: uiAccountDescription(targetAccountId),
            projectName: projectConfig.name,
          }),
          succeedColor: 'white',
        });
      } catch (err) {
        logger.log(i18n(`${i18nKey}.status.failedToCreateProject`));
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      // We cannot continue if the project does not exist in the target account
      logger.log(i18n(`${i18nKey}.logs.choseNotToCreateProject`));
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  SpinniesManager.add('devModeSetup', {
    text: i18n(`${i18nKey}.status.startupMessage`, {
      projectName: projectConfig.name,
    }),
    isParent: true,
  });

  let initialUploadResult;

  // Create an initial build if the project was newly created in the account or if
  // our upload permission is set to "always"
  if (!projectExists || uploadPermission === UPLOAD_PERMISSIONS.always) {
    initialUploadResult = await handleProjectUpload(
      targetAccountId,
      projectConfig,
      projectDir,
      (...args) => pollProjectBuildAndDeploy(...args, true),
      i18n(`${i18nKey}.logs.initialUploadMessage`)
    );

    if (initialUploadResult.uploadError) {
      SpinniesManager.fail('devModeSetup');

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
  }

  // Let the user know when the initial build or deploy fails
  // Do this before starting the dev server for v2 behavior because we cannot
  // run a server on a broken project
  if (
    options.extension &&
    initialUploadResult &&
    !initialUploadResult.succeeded
  ) {
    SpinniesManager.fail('devModeSetup');

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
      console.log(failedSubTask.errorMessage);
    });
    logger.log();

    process.exit(EXIT_CODES.ERROR);
  }

  SpinniesManager.remove('devModeSetup');

  const LocalDev = options.extension
    ? new LocalDevManagerV2({
        debug: options.debug,
        extension: options.extension,
        projectConfig,
        projectDir,
        targetAccountId,
      })
    : new LocalDevManager({
        debug: options.debug,
        projectConfig,
        projectDir,
        targetAccountId,
        uploadPermission,
      });

  await LocalDev.start();

  // Let the user know when the initial build or deploy fails
  if (
    !options.extension &&
    initialUploadResult &&
    !initialUploadResult.succeeded
  ) {
    if (initialUploadResult.buildResult.status === 'FAILURE') {
      LocalDev.logBuildError(initialUploadResult.buildResult);
    } else if (initialUploadResult.deployResult.status === 'FAILURE') {
      LocalDev.logDeployError(initialUploadResult.deployResult);
    }
  }

  handleExit(LocalDev.stop);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.option('extension', {
    describe: i18n(`${i18nKey}.options.extension.describe`),
    type: 'string',
    hidden: true,
  });

  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
