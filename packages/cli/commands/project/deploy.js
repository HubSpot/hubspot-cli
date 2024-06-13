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
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  deployProject,
  fetchProject,
} = require('@hubspot/local-dev-lib/api/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const { getProjectConfig, pollDeployStatus } = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const { buildIdPrompt } = require('../../lib/prompts/buildIdPrompt');
const { i18n } = require('../../lib/lang');
const { uiBetaTag } = require('../../lib/ui');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'commands.project.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiCommandReference, uiAccountDescription } = require('../../lib/ui');

exports.command = 'deploy [--project] [--buildId]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

const validateBuildId = (buildId, deployedBuildId, latestBuildId, projectName) => {
  if (Number(buildId) > latestBuildId) {
    return i18n(`${i18nKey}.errors.buildIdDoesNotExist`, {
      buildId: buildId,
      projectName,
    });
  }
  if (Number(buildId) === deployedBuildId) {
    return i18n(`${i18nKey}.errors.buildAlreadyDeployed`, {
      buildId: buildId,
    });
  }
  return true;
}

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const { project: projectOption, buildId: buildIdOption } = options;
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-deploy', { type: accountType }, accountId);

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
    const { latestBuild, deployedBuildId } = await fetchProject(
      accountId,
      projectName
    );

    if (!latestBuild || !latestBuild.buildId) {
      logger.error(i18n(`${i18nKey}.errors.noBuilds`));
      process.exit(EXIT_CODES.ERROR);
    }

    if (buildIdToDeploy) {
      const validationResult = validateBuildId(buildIdToDeploy, latestBuild.buildId, deployedBuildId, projectName);
      if(validationResult !== true) {
        logger.error(validationResult)
        process.exit(EXIT_CODES.ERROR);
      }
    } else {
      const buildIdPromptResponse = await buildIdPrompt(
        latestBuild.buildId,
        deployedBuildId,
        projectName,
        (buildId) =>
          validateBuildId(buildId, latestBuild.buildId, deployedBuildId, projectName)
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
      process.exit(EXIT_CODES.ERROR);
    }

    await pollDeployStatus(
      accountId,
      projectName,
      deployResp.id,
      buildIdToDeploy
    );
  } catch (e) {
    if (e.response && e.response.status === 404) {
      logger.error(
        i18n(`${i18nKey}.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountIdentifier: uiAccountDescription(accountId),
          command: uiCommandReference('hs project upload'),
        })
      );
    } else if (e.response && e.response.status === 400) {
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
      alias: ['build'],
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

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
