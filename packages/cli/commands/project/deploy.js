const chalk = require('chalk');
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
} = require('../../lib/errorHandlers/apiErrors');
const { logger } = require('@hubspot/cli-lib/logger');
const { deployProject, fetchProject } = require('@hubspot/cli-lib/api/dfs');
const { loadAndValidateOptions } = require('../../lib/validation');
const { getProjectConfig, pollDeployStatus } = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const { buildIdPrompt } = require('../../lib/prompts/buildIdPrompt');
const { i18n } = require('../../lib/lang');
const { uiBetaTag } = require('../../lib/ui');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'cli.commands.project.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiCommandReference, uiAccountDescription } = require('../../lib/ui');

exports.command = 'deploy [--project] [--buildId]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const { project: projectOption, buildId: buildIdOption } = options;
  const sandboxType = accountConfig && accountConfig.sandboxAccountType;

  trackCommandUsage('project-deploy', { type: sandboxType }, accountId);

  const { projectConfig } = await getProjectConfig();

  let projectName = projectOption;

  if (!projectOption && projectConfig) {
    projectName = projectConfig.name;
  }

  const namePromptResponse = await projectNamePrompt(accountId, {
    project: projectName,
  });

  if (!projectName && namePromptResponse.projectName) {
    projectName = namePromptResponse.projectName;
  }

  let buildIdToDeploy = buildIdOption;

  try {
    if (!buildIdOption) {
      const { latestBuild, deployedBuildId } = await fetchProject(
        accountId,
        projectName
      );
      if (!latestBuild || !latestBuild.buildId) {
        logger.error(i18n(`${i18nKey}.errors.noBuilds`));
        process.exit(EXIT_CODES.ERROR);
      }
      const buildIdPromptResponse = await buildIdPrompt(
        latestBuild.buildId,
        deployedBuildId,
        projectName
      );

      buildIdToDeploy = buildIdPromptResponse.buildId;
    }

    if (!buildIdToDeploy) {
      logger.error(i18n(`${i18nKey}.errors.noBuildId`));
      process.exit(EXIT_CODES.ERROR);
    }

    const deployResp = await deployProject(
      accountId,
      projectName,
      buildIdToDeploy
    );

    if (deployResp.error) {
      logger.error(
        i18n(`${i18nKey}.errors.deploy`, {
          details: deployResp.error.message,
        })
      );
      return;
    }

    await pollDeployStatus(
      accountId,
      projectName,
      deployResp.id,
      buildIdToDeploy
    );
  } catch (e) {
    if (e.statusCode === 404) {
      logger.error(
        i18n(`${i18nKey}.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountIdentifier: uiAccountDescription(accountId),
          command: uiCommandReference('hs project upload'),
        })
      );
    }
    if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else {
      logApiErrorInstance(e, new ApiErrorContext({ accountId, projectName }));
    }
    process.exit(EXIT_CODES.ERROR);
  }
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
