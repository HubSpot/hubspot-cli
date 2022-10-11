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
const { getProjectConfig, pollDeployStatus } = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getAccountConfig } = require('@hubspot/cli-lib');

const i18nKey = 'cli.commands.project.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'deploy [--project] [--buildId]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const { project, buildId } = options;
  const sandboxType = accountConfig && accountConfig.sandboxAccountType;

  trackCommandUsage('project-deploy', { type: sandboxType }, accountId);

  const { projectConfig } = await getProjectConfig();

  let projectName = project;

  if (!projectName && projectConfig) {
    projectName = projectConfig.name;
  }

  const namePrompt = await projectNamePrompt(accountId, {
    project: projectName,
  });

  if (!projectName && namePrompt.projectName) {
    projectName = namePrompt.projectName;
  }

  let exitCode = EXIT_CODES.SUCCESS;

  const getBuildId = async () => {
    const { latestBuild } = await fetchProject(accountId, projectName);
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
      projectName,
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
      projectName,
      deployResp.id,
      deployedBuildId
    );
  } catch (e) {
    if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else {
      logApiErrorInstance(e, new ApiErrorContext({ accountId, projectName }));
    }
    exitCode = 1;
  }
  process.exit(exitCode);
};

exports.builder = yargs => {
  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
    buildId: {
      describe: i18n(`${i18nKey}.options.buildId.describe`),
      type: 'number',
    },
  });

  yargs.example([['$0 project deploy', i18n(`${i18nKey}.examples.default`)]]);
  yargs.example([
    [
      '$0 project deploy --project="my-project" --buildId=5',
      i18n(`${i18nKey}.examples.withOptions`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
