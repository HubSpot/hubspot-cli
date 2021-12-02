const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { deployProject, fetchProject } = require('@hubspot/cli-lib/api/dfs');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  getProjectConfig,
  pollDeployStatus,
  validateProjectConfig,
} = require('../../lib/projects');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'deploy [path]';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: projectPath, buildId } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-deploy', { projectPath }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  logger.debug(
    i18n(`${i18nKey}.debug.deploying`, {
      path: projectPath,
    })
  );

  let exitCode = EXIT_CODES.SUCCESS;

  const getBuildId = async () => {
    const { latestBuild } = await fetchProject(accountId, projectConfig.name);
    if (latestBuild && latestBuild.buildId) {
      return latestBuild.buildId;
    }
    logger.error(i18n(`${i18nKey}.errors.noBuildId`));
    exitCode = EXIT_CODES.ERROR;
    return;
  };

  try {
    const deployedBuildId = buildId || (await getBuildId());

    const deployResp = await deployProject(
      accountId,
      projectConfig.name,
      deployedBuildId
    );

    if (deployResp.error) {
      logger.error(
        i18n(`${i18nKey}.errors.deploy`, {
          details: deployResp.error.message,
        })
      );
      exitCode = EXIT_CODES.ERROR;
      return;
    }

    await pollDeployStatus(
      accountId,
      projectConfig.name,
      deployResp.id,
      deployedBuildId
    );
  } catch (e) {
    if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else {
      logApiErrorInstance(e, new ApiErrorContext({ accountId, projectPath }));
    }
    exitCode = 1;
  }
  process.exit(exitCode);
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.options({
    buildId: {
      describe: i18n(`${i18nKey}.options.buildId.describe`),
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project deploy myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
