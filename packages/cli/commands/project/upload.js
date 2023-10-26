const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const chalk = require('chalk');
const { logger } = require('@hubspot/cli-lib/logger');
const { uiBetaTag, uiLine } = require('../../lib/ui');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  ensureProjectExists,
  getProjectConfig,
  handleProjectUpload,
  logFeedbackMessage,
  validateProjectConfig,
  pollProjectBuildAndDeploy,
  showPlatformVersionWarning,
} = require('../../lib/projects');
const { i18n } = require('../../lib/lang');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { ERROR_TYPES } = require('@hubspot/cli-lib/lib/constants');
const {
  logApiErrorInstance,
  ApiErrorContext,
  isSpecifiedError,
} = require('../../lib/errorHandlers/apiErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.upload';

exports.command = 'upload [path]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, path: projectPath, message } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const sandboxType = accountConfig && accountConfig.sandboxAccountType;

  trackCommandUsage('project-upload', { type: sandboxType }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await showPlatformVersionWarning(accountId, projectConfig);

  await ensureProjectExists(accountId, projectConfig.name, { forceCreate });

  try {
    const result = await handleProjectUpload(
      accountId,
      projectConfig,
      projectDir,
      pollProjectBuildAndDeploy,
      message
    );

    if (result.uploadError) {
      if (
        isSpecifiedError(result.uploadError, {
          subCategory: ERROR_TYPES.PROJECT_LOCKED,
        })
      ) {
        logger.log();
        logger.error(i18n(`${i18nKey}.errors.projectLockedError`));
        logger.log();
      } else {
        logApiErrorInstance(
          result.uploadError,
          new ApiErrorContext({
            accountId,
            projectName: projectConfig.name,
          })
        );
      }
      process.exit(EXIT_CODES.ERROR);
    }
    if (result.succeeded && !result.buildResult.isAutoDeployEnabled) {
      uiLine();
      logger.log(
        chalk.bold(
          i18n(`${i18nKey}.logs.buildSucceeded`, {
            buildId: result.buildId,
          })
        )
      );
      uiLine();
      logFeedbackMessage(result.buildId);
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    const projectName = projectConfig.name;
    logApiErrorInstance(e, new ApiErrorContext({ accountId, projectName }));
    process.exit(EXIT_CODES.ERROR);
  }
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
