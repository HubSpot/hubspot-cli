// @ts-nocheck
const { i18n } = require('../../lib/lang');
const { createWatcher } = require('../../lib/projects/watch');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { PROJECT_ERROR_TYPES } = require('../../lib/constants');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiBetaTag } = require('../../lib/ui');
const {
  ensureProjectExists,
  getProjectConfig,
  validateProjectConfig,
  logFeedbackMessage,
} = require('../../lib/projects');
const { handleProjectUpload } = require('../../lib/projects/upload');
const {
  pollBuildStatus,
  pollDeployStatus,
} = require('../../lib/projects/buildAndDeploy');
const {
  cancelStagedBuild,
  fetchProjectBuilds,
} = require('@hubspot/local-dev-lib/api/projects');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/index');
const { loadAndValidateOptions } = require('../../lib/validation');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { handleKeypress, handleExit } = require('../../lib/process');

const i18nKey = 'commands.project.subcommands.watch';

exports.command = 'watch';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

const handleBuildStatus = async (accountId, projectName, buildId) => {
  const { isAutoDeployEnabled, deployStatusTaskLocator } =
    await pollBuildStatus(accountId, projectName, buildId);

  if (isAutoDeployEnabled && deployStatusTaskLocator) {
    await pollDeployStatus(
      accountId,
      projectName,
      deployStatusTaskLocator.id,
      buildId
    );
  }

  logFeedbackMessage(buildId);
};

const handleUserInput = (accountId, projectName, currentBuildId) => {
  const onTerminate = async () => {
    logger.log(i18n(`${i18nKey}.logs.processExited`));

    if (currentBuildId) {
      try {
        await cancelStagedBuild(accountId, projectName);
        process.exit(EXIT_CODES.SUCCESS);
      } catch (err) {
        if (
          isSpecifiedError(err, {
            subCategory: PROJECT_ERROR_TYPES.BUILD_NOT_IN_PROGRESS,
          })
        ) {
          process.exit(EXIT_CODES.SUCCESS);
        } else {
          logError(err, new ApiErrorContext({ accountId }));
          process.exit(EXIT_CODES.ERROR);
        }
      }
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  };

  handleExit(onTerminate);
  handleKeypress(key => {
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      onTerminate();
    }
  });
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { initialUpload, derivedAccountId } = options;

  trackCommandUsage('project-watch', null, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(derivedAccountId, projectConfig.name);

  try {
    const {
      data: { results: builds },
    } = await fetchProjectBuilds(derivedAccountId, projectConfig.name, options);
    const hasNoBuilds = !builds || !builds.length;

    const startWatching = async () => {
      await createWatcher(
        derivedAccountId,
        projectConfig,
        projectDir,
        handleBuildStatus,
        handleUserInput
      );
    };

    // Upload all files if no build exists for this project yet
    if (initialUpload || hasNoBuilds) {
      const result = await handleProjectUpload(
        derivedAccountId,
        projectConfig,
        projectDir,
        startWatching
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
    } else {
      await startWatching();
    }
  } catch (e) {
    logError(e, new ApiErrorContext({ accountId: derivedAccountId }));
  }
};

exports.builder = yargs => {
  yargs.option('initial-upload', {
    alias: 'i',
    describe: i18n(`${i18nKey}.options.initialUpload.describe`),
    type: 'boolean',
  });

  yargs.example([['$0 project watch', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
