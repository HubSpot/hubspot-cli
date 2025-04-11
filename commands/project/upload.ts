// @ts-nocheck
const { useV3Api } = require('../../lib/projects/buildAndDeploy');

const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const chalk = require('chalk');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { uiBetaTag, uiCommandReference } = require('../../lib/ui');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  ensureProjectExists,
  getProjectConfig,
  logFeedbackMessage,
  validateProjectConfig,
} = require('../../lib/projects');
const { handleProjectUpload } = require('../../lib/projects/upload');
const {
  displayWarnLogs,
  pollProjectBuildAndDeploy,
} = require('../../lib/projects/buildAndDeploy');
const { i18n } = require('../../lib/lang');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/index');
const { PROJECT_ERROR_TYPES } = require('../../lib/constants');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'commands.project.subcommands.upload';

exports.command = 'upload';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  const { forceCreate, message, derivedAccountId, skipValidation } = options;
  const accountConfig = getAccountConfig(derivedAccountId);
  const accountType = accountConfig && accountConfig.accountType;

  const { projectConfig, projectDir } = await getProjectConfig();

  trackCommandUsage('project-upload', { type: accountType }, derivedAccountId);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(derivedAccountId, projectConfig.name, {
    forceCreate,
    uploadCommand: true,
  });

  try {
    console.log('options.env', options.env);
    const { result, uploadError } = await handleProjectUpload(
      derivedAccountId,
      projectConfig,
      projectDir,
      pollProjectBuildAndDeploy,
      message,
      useV3Api(projectConfig?.platformVersion),
      skipValidation,
      options.env
    );

    if (uploadError) {
      if (
        isSpecifiedError(uploadError, {
          subCategory: PROJECT_ERROR_TYPES.PROJECT_LOCKED,
        })
      ) {
        logger.log();
        logger.error(i18n(`${i18nKey}.errors.projectLockedError`));
        logger.log();
      } else {
        logError(
          uploadError,
          new ApiErrorContext({
            accountId: derivedAccountId,
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

      await displayWarnLogs(
        derivedAccountId,
        projectConfig.name,
        result.buildId
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: 'project upload',
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.options({
    'force-create': {
      describe: i18n(`${i18nKey}.options.forceCreate.describe`),
      type: 'boolean',
      default: false,
    },
    message: {
      alias: 'm',
      describe: i18n(`${i18nKey}.options.message.describe`),
      type: 'string',
      default: '',
    },
    'skip-validation': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
    env: {
      type: 'string',
      describe: i18n(`${i18nKey}.options.env.describe`),
      hidden: true,
    },
  });

  yargs.example([['$0 project upload', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
