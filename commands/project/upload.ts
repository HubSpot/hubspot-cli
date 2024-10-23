// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const chalk = require('chalk');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { uiBetaTag, uiCommandReference } = require('../../lib/ui');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  ensureProjectExists,
  getProjectConfig,
  handleProjectUpload,
  logFeedbackMessage,
  validateProjectConfig,
  pollProjectBuildAndDeploy,
  displayWarnLogs,
} = require('../../lib/projects');
const { i18n } = require('../../lib/lang');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/index');
const { PROJECT_ERROR_TYPES } = require('../../lib/constants');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'commands.project.subcommands.upload';

exports.command = 'upload [path] [--forceCreate] [--message]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, path: projectPath, message, account } = options;
  const accountConfig = getAccountConfig(account);
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-upload', { type: accountType }, account);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(account, projectConfig.name, {
    forceCreate,
    uploadCommand: true,
  });

  try {
    const result = await handleProjectUpload(
      account,
      projectConfig,
      projectDir,
      pollProjectBuildAndDeploy,
      message
    );

    if (result.uploadError) {
      if (
        isSpecifiedError(result.uploadError, {
          subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
        })
      ) {
        logger.log();
        logger.error(i18n(`${i18nKey}.errors.projectLockedError`));
        logger.log();
      } else {
        logError(
          result.uploadError,
          new ApiErrorContext({
            accountId: account,
            request: 'project upload',
          })
        );
      }
      process.exit(EXIT_CODES.ERROR);
    }
    if (result.succeeded && !result.buildResult.isAutoDeployEnabled) {
      logger.log(
        chalk.bold(
          i18n(`${i18nKey}.logs.buildSucceeded`, {
            buildId: result.buildId,
          })
        )
      );
      logger.log(
        i18n(`${i18nKey}.logs.autoDeployDisabled`, {
          deployCommand: uiCommandReference(
            `hs project deploy --build=${result.buildId}`
          ),
        })
      );
      logFeedbackMessage(result.buildId);

      await displayWarnLogs(account, projectConfig.name, result.buildId);
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({ accountId: account, request: 'project upload' })
    );
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

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
