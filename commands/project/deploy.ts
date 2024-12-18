// @ts-nocheck
const chalk = require('chalk');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  deployProject,
  fetchProject,
} = require('@hubspot/local-dev-lib/api/projects');
const {
  getProjectConfig,
  pollDeployStatus,
  getProjectDetailUrl,
} = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { i18n } = require('../../lib/lang');
const { uiBetaTag, uiLink } = require('../../lib/ui');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiCommandReference, uiAccountDescription } = require('../../lib/ui');
const { isHubSpotHttpError } = require('@hubspot/local-dev-lib/errors/index');

const i18nKey = 'commands.project.subcommands.deploy';

exports.command = 'deploy';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

const validateBuildId = (
  buildId,
  deployedBuildId,
  latestBuildId,
  projectName,
  accountId
) => {
  if (Number(buildId) > latestBuildId) {
    return i18n(`${i18nKey}.errors.buildIdDoesNotExist`, {
      buildId: buildId,
      projectName,
      linkToProject: uiLink(
        i18n(`${i18nKey}.errors.viewProjectsBuilds`),
        getProjectDetailUrl(projectName, accountId)
      ),
    });
  }
  if (Number(buildId) === deployedBuildId) {
    return i18n(`${i18nKey}.errors.buildAlreadyDeployed`, {
      buildId: buildId,
      linkToProject: uiLink(
        i18n(`${i18nKey}.errors.viewProjectsBuilds`),
        getProjectDetailUrl(projectName, accountId)
      ),
    });
  }
  return true;
};

exports.handler = async options => {
  const { derivedAccountId } = options;
  const accountConfig = getAccountConfig(derivedAccountId);
  const { project: projectOption, buildId: buildIdOption } = options;
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-deploy', { type: accountType }, derivedAccountId);

  const { projectConfig } = await getProjectConfig();

  let projectName = projectOption;

  if (!projectOption && projectConfig) {
    projectName = projectConfig.name;
  }

  const namePromptResponse = await projectNamePrompt(derivedAccountId, {
    project: projectName,
  });

  if (!projectName && namePromptResponse.projectName) {
    projectName = namePromptResponse.projectName;
  }

  let buildIdToDeploy = buildIdOption;

  try {
    const {
      data: { latestBuild, deployedBuildId },
    } = await fetchProject(derivedAccountId, projectName);

    if (!latestBuild || !latestBuild.buildId) {
      logger.error(i18n(`${i18nKey}.errors.noBuilds`));
      return process.exit(EXIT_CODES.ERROR);
    }

    if (buildIdToDeploy) {
      const validationResult = validateBuildId(
        buildIdToDeploy,
        deployedBuildId,
        latestBuild.buildId,
        projectName,
        derivedAccountId
      );
      if (validationResult !== true) {
        logger.error(validationResult);
        return process.exit(EXIT_CODES.ERROR);
      }
    } else {
      const deployBuildIdPromptResponse = await promptUser({
        name: 'buildId',
        message: i18n(`${i18nKey}.deployBuildIdPrompt`),
        default:
          latestBuild.buildId === deployedBuildId
            ? undefined
            : latestBuild.buildId,
        validate: () =>
          validateBuildId(
            buildId,
            deployedBuildId,
            latestBuild.buildId,
            projectName,
            derivedAccountId
          ),
      });
      buildIdToDeploy = deployBuildIdPromptResponse.buildId;
    }

    if (!buildIdToDeploy) {
      logger.error(i18n(`${i18nKey}.errors.noBuildId`));
      return process.exit(EXIT_CODES.ERROR);
    }

    const { data: deployResp } = await deployProject(
      derivedAccountId,
      projectName,
      buildIdToDeploy
    );

    if (!deployResp || deployResp.error) {
      logger.error(
        i18n(`${i18nKey}.errors.deploy`, {
          details: deployResp.error.message,
        })
      );
      return process.exit(EXIT_CODES.ERROR);
    }

    await pollDeployStatus(
      derivedAccountId,
      projectName,
      deployResp.id,
      buildIdToDeploy
    );
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      logger.error(
        i18n(`${i18nKey}.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountIdentifier: uiAccountDescription(derivedAccountId),
          command: uiCommandReference('hs project upload'),
        })
      );
    } else if (isHubSpotHttpError(e) && e.status === 400) {
      logger.error(e.message);
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: 'project deploy',
        })
      );
    }
    return process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
    build: {
      alias: ['build-id'],
      describe: i18n(`${i18nKey}.options.build.describe`),
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project deploy', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 project deploy --project="my-project" --build=5',
      i18n(`${i18nKey}.examples.withOptions`),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
