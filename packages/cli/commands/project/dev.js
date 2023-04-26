const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { getConfigAccounts } = require('@hubspot/cli-lib/lib/config');
const { createProject } = require('@hubspot/cli-lib/api/dfs');
const { handleKeypress, handleExit } = require('@hubspot/cli-lib/lib/process');
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
const LocalDevManager = require('../../lib/LocalDevManager');
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
    } = await selectTargetAccountPrompt(accounts);

    targetAccountId = promptTargetAccountId;
    chooseNonSandbox = promptChooseNonSandbox;
    createNewSandbox = promptCreateNewSandbox;
  }

  logger.log();

  // Show a warning if the user chooses a non-sandbox account (false)
  if (chooseNonSandbox) {
    uiLine();
    logger.warn(i18n(`${i18nKey}.logs.prodAccountWarning`));
    uiLine();
    logger.log();

    const shouldTargetNonSandboxAccount = await confirmPrompt(
      i18n(`${i18nKey}.prompt.targetNonSandbox`)
    );

    if (shouldTargetNonSandboxAccount) {
      const {
        targetAccountId: promptNonSandboxTargetAccountId,
      } = await selectTargetAccountPrompt(accounts, true);

      targetAccountId = promptNonSandboxTargetAccountId;
      logger.log();
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  } else if (createNewSandbox) {
    try {
      await validateSandboxUsageLimits(accountConfig, DEVELOPER_SANDBOX, env);
    } catch (err) {
      logErrorInstance(err);
      process.exit(EXIT_CODES.ERROR);
    }
    try {
      const { name } = await sandboxNamePrompt();
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
      let syncTasks = await getAvailableSyncTypes(
        accountConfig,
        sandboxAccountConfig
      );
      await syncSandbox({
        accountConfig: sandboxAccountConfig,
        parentAccountConfig: accountConfig,
        env,
        syncTasks,
        allowEarlyTermination: false, // Don't let user terminate early in this flow
        skipPolling: true,
      });
    } catch (err) {
      logErrorInstance(err);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  // TODO programatically determine these values
  const isNonSandboxAccount = false;
  const isProjectUsingGitIntegration = false;

  let preventUploads = false;

  if (isProjectUsingGitIntegration || isNonSandboxAccount) {
    uiLine();
    logger.warn(i18n(`${i18nKey}.logs.preventUploadExplanation`));
    uiLine();
    logger.log();

    if (isProjectUsingGitIntegration) {
      preventUploads = true;
    } else {
      preventUploads = await confirmPrompt(
        i18n(`${i18nKey}.prompt.preventUploads`)
      );
    }
  }

  const spinnies = SpinniesManager.init();

  const projectExists = await ensureProjectExists(
    targetAccountId,
    projectConfig.name,
    {
      allowCreate: true,
      noLogs: true,
    }
  );

  if (!projectExists) {
    logger.log(i18n(`${i18nKey}.logs.projectNotInAccount`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logs.projectMustExistExplanation`));
    uiLine();

    if (preventUploads) {
      logger.log(i18n(`${i18nKey}.logs.unableToCreateProject`));
      process.exit(EXIT_CODES.ERROR);
    }

    const shouldCreateProject = await confirmPrompt(
      i18n(`${i18nKey}.prompt.createProject`, {
        accountName: uiAccountDescription(targetAccountId),
      })
    );

    if (shouldCreateProject) {
      try {
        spinnies.add('createProject', {
          text: 'Creating project in account',
        });
        await createProject(targetAccountId, projectConfig.name);
        spinnies.succeed('createProject', {
          text: 'Created project in account',
        });
      } catch (err) {
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  spinnies.add('devModeSetup', {
    text: i18n(`${i18nKey}.logs.startupMessage`, {
      projectName: projectConfig.name,
      accountIdentifier: uiAccountDescription(targetAccountId),
    }),
    isParent: true,
  });

  let result;
  if (!preventUploads) {
    result = await handleProjectUpload(
      targetAccountId,
      projectConfig,
      projectDir,
      (...args) => pollProjectBuildAndDeploy(...args, true),
      'HubSpot Local Dev Server Startup'
    );
  }

  if (result && !result.succeeded) {
    spinnies.fail('devModeSetup', {
      text: 'failed to start up dev mode',
    });
    process.exit(EXIT_CODES.ERROR);
  } else {
    spinnies.remove('devModeSetup');
  }

  const LocalDev = new LocalDevManager({
    targetAccountId,
    projectConfig,
    projectDir,
    preventUploads,
    debug: options.debug,
  });

  await LocalDev.start();

  handleExit(LocalDev.stop);
  handleKeypress(key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      LocalDev.stop();
    }
  });
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};