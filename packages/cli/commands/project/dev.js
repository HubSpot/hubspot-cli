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
} = require('../../lib/projects');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiAccountDescription, uiLine } = require('../../lib/ui');
const { confirmPrompt } = require('../../lib/prompts/promptUtils');
const {
  selectTargetAccountPrompt,
} = require('../../lib/prompts/projectDevTargetAccountPrompt');
const SpinniesManager = require('../../lib/SpinniesManager');
const {
  LocalDevManager,
  UPLOAD_PERMISSIONS,
} = require('../../lib/LocalDevManager');
const { getAccountConfig, getEnv } = require('@hubspot/cli-lib');
const { sandboxNamePrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  validateSandboxUsageLimits,
  DEVELOPER_SANDBOX,
  getAvailableSyncTypes,
} = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/cli-lib/lib/environment');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { buildSandbox } = require('../../lib/sandbox-create');
const { syncSandbox } = require('../../lib/sandbox-sync');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  isMissingScopeError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');

const i18nKey = 'cli.commands.project.subcommands.dev';

exports.command = 'dev [--account] [--mockServers]';
exports.describe = null; //i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = getValidEnv(getEnv(accountId));

  trackCommandUsage('project-dev', null, accountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  logger.log(i18n(`${i18nKey}.logs.introHeader`));
  uiLine();
  logger.log(i18n(`${i18nKey}.logs.introBody1`));
  logger.log();
  logger.log(i18n(`${i18nKey}.logs.introBody2`));
  uiLine();
  logger.log();

  if (!projectConfig) {
    logger.error(i18n(`${i18nKey}.errors.noProjectConfig`));
    process.exit(EXIT_CODES.ERROR);
  }

  const accounts = getConfigAccounts();
  let targetAccountId = options.accountId;
  let createNewSandbox = false;
  let chooseNonSandbox = false;

  if (!targetAccountId) {
    const {
      targetAccountId: promptTargetAccountId,
      chooseNonSandbox: promptChooseNonSandbox,
      createNewSandbox: promptCreateNewSandbox,
    } = await selectTargetAccountPrompt(accounts, accountConfig, false);

    targetAccountId = promptTargetAccountId;
    chooseNonSandbox = promptChooseNonSandbox;
    createNewSandbox = promptCreateNewSandbox;
  }

  logger.log();

  // Show a warning if the user chooses a non-sandbox account (false)
  let shouldTargetNonSandboxAccount;
  if (chooseNonSandbox) {
    uiLine();
    logger.warn(i18n(`${i18nKey}.logs.prodAccountWarning`));
    uiLine();
    logger.log();

    shouldTargetNonSandboxAccount = await confirmPrompt(
      i18n(`${i18nKey}.prompt.targetNonSandbox`)
    );

    if (shouldTargetNonSandboxAccount) {
      const {
        targetAccountId: promptNonSandboxTargetAccountId,
      } = await selectTargetAccountPrompt(accounts, accountConfig, true);

      targetAccountId = promptNonSandboxTargetAccountId;
      logger.log();
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  } else if (createNewSandbox) {
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

  const isNonSandboxAccount = shouldTargetNonSandboxAccount;

  let uploadPermission = isNonSandboxAccount
    ? UPLOAD_PERMISSIONS.manual
    : UPLOAD_PERMISSIONS.always;

  if (projectExists) {
    const { sourceIntegration } = await fetchProject(
      targetAccountId,
      projectConfig.name
    );
    if (sourceIntegration) {
      uploadPermission = UPLOAD_PERMISSIONS.never;
    }
  }

  const spinnies = SpinniesManager.init();

  if (!projectExists) {
    uiLine();
    logger.warn(
      i18n(`${i18nKey}.logs.projectMustExistExplanation`, {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      })
    );
    uiLine();

    const shouldCreateProject = await confirmPrompt(
      i18n(`${i18nKey}.prompt.createProject`, {
        accountIdentifier: uiAccountDescription(targetAccountId),
        projectName: projectConfig.name,
      })
    );

    if (shouldCreateProject) {
      try {
        spinnies.add('createProject', {
          text: i18n(`${i18nKey}.status.creatingProject`, {
            accountIdentifier: uiAccountDescription(targetAccountId),
            projectName: projectConfig.name,
          }),
        });
        await createProject(targetAccountId, projectConfig.name);
        spinnies.succeed('createProject', {
          text: i18n(`${i18nKey}.status.createdProject`, {
            accountIdentifier: uiAccountDescription(targetAccountId),
            projectName: projectConfig.name,
          }),
        });
      } catch (err) {
        logger.log(i18n(`${i18nKey}.logs.failedToCreateProject`));
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      // We cannot continue if the project does not exist in the target account
      logger.log(i18n(`${i18nKey}.logs.choseNotToCreateProject`));
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  spinnies.add('devModeSetup', {
    text: i18n(`${i18nKey}.status.startupMessage`, {
      projectName: projectConfig.name,
    }),
    isParent: true,
  });

  let result;
  if (uploadPermission === UPLOAD_PERMISSIONS.always) {
    result = await handleProjectUpload(
      targetAccountId,
      projectConfig,
      projectDir,
      (...args) => pollProjectBuildAndDeploy(...args, true),
      i18n(`${i18nKey}.logs.initialUploadMessage`)
    );
  }

  if (result && !result.succeeded) {
    spinnies.fail('devModeSetup', {
      text: i18n(`${i18nKey}.status.startupFailed`),
    });
    process.exit(EXIT_CODES.ERROR);
  } else {
    spinnies.remove('devModeSetup');
  }

  const LocalDev = new LocalDevManager({
    debug: options.debug,
    mockServers: options.mockServers,
    projectConfig,
    projectDir,
    targetAccountId,
    uploadPermission,
  });

  await LocalDev.start();

  handleExit(LocalDev.stop);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.option('mockServers', {
    describe: 'mock servers',
    type: 'boolean',
    default: false,
  });
  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
