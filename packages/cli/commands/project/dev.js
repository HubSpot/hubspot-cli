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
const { createProject } = require('@hubspot/cli-lib/api/dfs');
const {
  getProjectConfig,
  ensureProjectExists,
  handleProjectUpload,
  pollProjectBuildAndDeploy,
} = require('../../lib/projects');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiAccountDescription, uiLine } = require('../../lib/ui');
const { promptUser } = require('../../lib/prompts/promptUtils');
const {
  selectTargetAccountPrompt,
} = require('../../lib/prompts/projectDevTargetAccountPrompt');
const SpinniesManager = require('../../lib/SpinniesManager');

const i18nKey = 'cli.commands.project.subcommands.dev';

exports.command = 'dev';
exports.describe = null; //i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);

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

  const { targetAccountId } = await selectTargetAccountPrompt(accountId);

  logger.log();

  // Show a warning if the user chooses a non-sandbox account
  if (targetAccountId) {
    uiLine();
    logger.warn(i18n(`${i18nKey}.logs.prodAccountWarning`));
    uiLine();
    logger.log();
  }

  const spinnies = SpinniesManager.init();

  spinnies.add('localDevInitialization', {
    text: i18n(`${i18nKey}.logs.startupMessage`, {
      projectName: projectConfig.name,
      accountName: uiAccountDescription(accountId),
    }),
    isParent: true,
  });

  const projectExists = await ensureProjectExists(
    accountId,
    projectConfig.name,
    {
      allowCreate: false,
      noLogs: true,
    }
  );

  if (!projectExists) {
    logger.log(i18n(`${i18nKey}.logs.projectNotInAccount`));
    uiLine();
    logger.log(i18n(`${i18nKey}.logs.projectMustExistExplanation`));
    uiLine();

    const { shouldCreateProject } = await promptUser([
      {
        name: 'shouldCreateProject',
        type: 'confirm',
        message: i18n(`${i18nKey}.prompt.createProject`, {
          accountName: uiAccountDescription(accountId),
        }),
      },
    ]);

    if (shouldCreateProject) {
      try {
        await createProject(accountId, projectConfig.name);
      } catch (err) {
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  const result = await handleProjectUpload(
    accountId,
    projectConfig,
    projectDir,
    (...args) => pollProjectBuildAndDeploy(...args, true),
    'HubSpot Local Dev Server Startup'
  );

  if (!result.succeeded) {
    spinnies.fail('localDevInitialization', {
      text: 'failed to start up dev mode',
    });
    process.exit(EXIT_CODES.ERROR);
  } else {
    spinnies.remove('localDevInitialization');
  }

  spinnies.add('localDevServerRunning', {
    text: 'Local dev server running. Waiting for project file changes ...',
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
