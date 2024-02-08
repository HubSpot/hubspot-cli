const { i18n } = require('../../lib/lang');
const { createWatcher } = require('../../lib/projectsWatch');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { logger } = require('@hubspot/cli-lib/logger');
const { ERROR_TYPES } = require('@hubspot/cli-lib/lib/constants');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiBetaTag } = require('../../lib/ui');
const {
  ensureProjectExists,
  getProjectConfig,
  handleProjectUpload,
  pollBuildStatus,
  pollDeployStatus,
  validateProjectConfig,
  logFeedbackMessage,
  showPlatformVersionWarning,
} = require('../../lib/projects');
const {
  cancelStagedBuild,
  fetchProjectBuilds,
} = require('@hubspot/cli-lib/api/dfs');
const { loadAndValidateOptions } = require('../../lib/validation');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { handleKeypress, handleExit } = require('../../lib/process');

const i18nKey = 'cli.commands.project.subcommands.watch';

exports.command = 'watch [path]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

const handleBuildStatus = async (accountId, projectName, buildId) => {
  const {
    isAutoDeployEnabled,
    deployStatusTaskLocator,
  } = await pollBuildStatus(accountId, projectName, buildId);

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
        if (err.error.subCategory === ERROR_TYPES.BUILD_NOT_IN_PROGRESS) {
          process.exit(EXIT_CODES.SUCCESS);
        } else {
          logApiErrorInstance(
            err,
            new ApiErrorContext({ accountId, projectName: projectName })
          );
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

  const { initialUpload, path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-watch', null, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await showPlatformVersionWarning(accountId, projectConfig);

  await ensureProjectExists(accountId, projectConfig.name);

  try {
    const { results: builds } = await fetchProjectBuilds(
      accountId,
      projectConfig.name,
      options
    );
    const hasNoBuilds = !builds || !builds.length;

    const startWatching = async () => {
      await createWatcher(
        accountId,
        projectConfig,
        projectDir,
        handleBuildStatus,
        handleUserInput
      );
    };

    // Upload all files if no build exists for this project yet
    if (initialUpload || hasNoBuilds) {
      await handleProjectUpload(
        accountId,
        projectConfig,
        projectDir,
        startWatching
      );
    } else {
      await startWatching();
    }
  } catch (e) {
    logApiErrorInstance(
      e,
      new ApiErrorContext({ accountId, projectName: projectConfig.name })
    );
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.option('initial-upload', {
    alias: 'i',
    describe: i18n(`${i18nKey}.options.initialUpload.describe`),
    type: 'boolean',
  });

  yargs.example([
    ['$0 project watch myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
