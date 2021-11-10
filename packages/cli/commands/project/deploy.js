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

exports.command = 'deploy [path]';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: projectPath, buildId } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-deploy', { projectPath }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  logger.debug(`Deploying project at path: ${projectPath}`);

  const getBuildId = async () => {
    const { latestBuild } = await fetchProject(accountId, projectConfig.name);
    if (latestBuild && latestBuild.buildId) {
      return latestBuild.buildId;
    }
    logger.error('No latest build ID was found.');
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
      logger.error(`Deploy error: ${deployResp.error.message}`);
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
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.options({
    buildId: {
      describe: 'Project build ID to be deployed',
      type: 'number',
    },
  });

  yargs.example([
    [
      '$0 project deploy myProjectFolder',
      'Deploy a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
