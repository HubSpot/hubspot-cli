const chalk = require('chalk');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { uiLine, uiAccountDescription } = require('../../lib/ui');
const { logger } = require('@hubspot/cli-lib/logger');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  ensureProjectExists,
  getProjectConfig,
  handleProjectUpload,
  pollBuildStatus,
  pollDeployStatus,
  validateProjectConfig,
} = require('../../lib/projects');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
// const { getAccountConfig } = require('@hubspot/cli-lib');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.project.subcommands.upload';

exports.command = 'upload [path]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, path: projectPath } = options;
  const accountId = getAccountId(options);
  // const accountConfig = getAccountConfig(accountId);
  // const sandboxType = accountConfig && accountConfig.sandboxAccountType;

  trackCommandUsage('project-upload', null, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(accountId, projectConfig.name, { forceCreate });

  const startPolling = async (tempFile, buildId) => {
    let exitCode = EXIT_CODES.SUCCESS;

    const {
      isAutoDeployEnabled,
      deployStatusTaskLocator,
      status,
    } = await pollBuildStatus(accountId, projectConfig.name, buildId);

    uiLine();

    if (status === 'FAILURE') {
      exitCode = EXIT_CODES.ERROR;
      return;
    } else if (isAutoDeployEnabled && deployStatusTaskLocator) {
      logger.log(
        i18n(`${i18nKey}.logs.buildSucceededAutomaticallyDeploying`, {
          accountIdentifier: uiAccountDescription(accountId),
          buildId,
        })
      );
      const { status } = await pollDeployStatus(
        accountId,
        projectConfig.name,
        deployStatusTaskLocator.id,
        buildId
      );
      if (status === 'FAILURE') {
        exitCode = EXIT_CODES.ERROR;
      }
    } else {
      uiLine();
      logger.log(
        chalk.bold(
          i18n(`${i18nKey}.logs.buildSucceeded`, {
            buildId,
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

    try {
      tempFile.removeCallback();
      logger.debug(
        i18n(`${i18nKey}.debug.cleanedUpTempFile`, {
          path: tempFile.name,
        })
      );
    } catch (e) {
      logger.error(e);
    }

    process.exit(exitCode);
  };

  await handleProjectUpload(accountId, projectConfig, projectDir, startPolling);
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

  yargs.example([
    ['$0 project upload myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
