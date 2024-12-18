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

const {
  translate,
  isTranslationError,
} = require('@hubspot/project-parsing-lib');
const path = require('path');

const i18nKey = 'commands.project.subcommands.upload';

exports.command = 'upload';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, message, derivedAccountId } = options;
  const accountConfig = getAccountConfig(derivedAccountId);
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-upload', { type: accountType }, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  let intermediateRepresentation;
  if (options.translate) {
    try {
      intermediateRepresentation = await translate({
        projectSourceDir: path.join(projectDir, projectConfig.srcDir),
        platformVersion: projectConfig.platformVersion,
        accountId: derivedAccountId,
      });
    } catch (e) {
      if (isTranslationError(e)) {
        logger.error(e.toString());
      } else {
        logError(e);
      }
      return process.exit(EXIT_CODES.ERROR);
    }
  }

  trackCommandUsage('project-upload', { type: accountType }, derivedAccountId);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(derivedAccountId, projectConfig.name, {
    forceCreate,
    uploadCommand: true,
  });

  try {
    const result = await handleProjectUpload(
      derivedAccountId,
      projectConfig,
      projectDir,
      pollProjectBuildAndDeploy,
      message,
      intermediateRepresentation
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
  });

  yargs.option('translate', {
    hidden: true,
    type: 'boolean',
    default: false,
  });

  yargs.example([['$0 project upload', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
