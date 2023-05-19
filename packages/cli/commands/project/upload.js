const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const chalk = require('chalk');
const { logger } = require('@hubspot/cli-lib/logger');
const { uiLine } = require('../../lib/ui');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  ensureProjectExists,
  getProjectConfig,
  handleProjectUpload,
  logFeedbackMessage,
  validateProjectConfig,
  pollProjectBuildAndDeploy,
} = require('../../lib/projects');
const { i18n } = require('../../lib/lang');
const { getAccountConfig } = require('@hubspot/cli-lib');
const { ERROR_TYPES } = require('@hubspot/cli-lib/lib/constants');
const {
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.upload';

exports.command = 'upload [path]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, path: projectPath, message } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const sandboxType = accountConfig && accountConfig.sandboxAccountType;

  trackCommandUsage('project-upload', { type: sandboxType }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(accountId, projectConfig.name, { forceCreate });

  const result = await handleProjectUpload(
    accountId,
    projectConfig,
    projectDir,
    pollProjectBuildAndDeploy,
    message
  );

  if (result.error) {
    logApiErrorInstance(
      result.error,
      new ApiErrorContext({
        accountId,
        projectName: projectConfig.name,
      })
    );
    if (
      isSpecifiedError(result.error, {
        subCategory: ERROR_TYPES.PROJECT_LOCKED,
      })
    ) {
      logger.log();
      logger.error(i18n(`${i18nKey}.errors.projectLockedError`));
      logger.log();
    }
    process.exit(EXIT_CODES.ERROR);
  }
  if (result.buildSucceeded && !result.autodeployEnabled) {
    uiLine();
    logger.log(
      chalk.bold(
        i18n(`${i18nKey}.logs.buildSucceeded`, {
          buildId: result.buildId,
        })
      )
    );
    logger.log(i18n(`${i18nKey}.logs.readyToGoLive`));
    logger.log(
      i18n(`${i18nKey}.logs.runCommand`, {
        command: chalk.hex('f5c26b')('hs project deploy'),
      })
    );
    uiLine();
  }

  logFeedbackMessage(result.buildId);
  process.exit(result.succeeded ? EXIT_CODES.SUCCESS : EXIT_CODES.ERROR);
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.option('forceCreate', {
    describe: i18n(`${i18nKey}.options.forceCreate.describe`),
    type: 'boolean',
    default: false,
  });

  yargs.option('message', {
    alias: 'm',
    describe: i18n(`${i18nKey}.options.message.describe`),
    type: 'string',
    default: '',
  });

  yargs.example([
    ['$0 project upload myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
