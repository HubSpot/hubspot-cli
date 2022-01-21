const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { createWatcher } = require('@hubspot/cli-lib/projectsWatch');
const { cancelStagedBuild } = require('@hubspot/cli-lib/api/dfs');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  getProjectConfig,
  validateProjectConfig,
  pollBuildStatus,
  pollDeployStatus,
} = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.watch';

exports.command = 'watch [path]';
exports.describe = i18n(`${i18nKey}.describe`);

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
};

const handleSigInt = (accountId, projectName, currentBuildId) => {
  process.removeAllListeners('SIGINT');
  process.on('SIGINT', async () => {
    if (currentBuildId) {
      try {
        await cancelStagedBuild(accountId, projectName);
        logger.debug(i18n(`${i18nKey}.debug.buildCancelled`));
        process.exit(EXIT_CODES.SUCCESS);
      } catch (err) {
        logApiErrorInstance(
          err,
          new ApiErrorContext({ accountId, projectName: projectName })
        );
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }
  });
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-watch', { projectPath }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await createWatcher(
    accountId,
    projectConfig,
    projectDir,
    handleBuildStatus,
    handleSigInt
  );
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 project watch myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
