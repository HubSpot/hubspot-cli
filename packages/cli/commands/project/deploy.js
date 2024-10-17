const chalk = require('chalk');
const {
  addAccountOptions,
  addConfigOptions,
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
const {
  getProjectConfig,
  pollDeployStatus,
  getProjectDetailUrl,
} = require('../../lib/projects');
const { projectNamePrompt } = require('../../lib/prompts/projectNamePrompt');
const {
  deployBuildIdPrompt,
} = require('../../lib/prompts/deployBuildIdPrompt');
const { i18n } = require('../../lib/lang');
const { uiBetaTag, uiLink } = require('../../lib/ui');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'commands.project.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { uiCommandReference, uiAccountDescription } = require('../../lib/ui');

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
  await loadAndValidateOptions(options);

  const { account } = options;
  const accountConfig = getAccountConfig(account);
  const { project: projectOption, buildId: buildIdOption } = options;
  const accountType = accountConfig && accountConfig.accountType;

  trackCommandUsage('project-deploy', { type: accountType }, account);

  const { projectConfig } = await getProjectConfig();

  let projectName = projectOption;

  if (!projectOption && projectConfig) {
    projectName = projectConfig.name;
  }

  const namePromptResponse = await projectNamePrompt(account, {
    project: projectName,
  });

  if (!projectName && namePromptResponse.projectName) {
    projectName = namePromptResponse.projectName;
  }

  let buildIdToDeploy = buildIdOption;

  try {
    const { latestBuild, deployedBuildId } = await fetchProject(
      account,
      projectName
    );

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
        account
      );
      if (validationResult !== true) {
        logger.error(validationResult);
        return process.exit(EXIT_CODES.ERROR);
      }
    } else {
      const deployBuildIdPromptResponse = await deployBuildIdPrompt(
        latestBuild.buildId,
        deployedBuildId,
        buildId =>
          validateBuildId(
            buildId,
            deployedBuildId,
            latestBuild.buildId,
            projectName,
            account
          )
      );
      buildIdToDeploy = deployBuildIdPromptResponse.buildId;
    }

    if (!buildIdToDeploy) {
      logger.error(i18n(`${i18nKey}.errors.noBuildId`));
      return process.exit(EXIT_CODES.ERROR);
    }

    const deployResp = await deployProject(
      account,
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
      account,
      projectName,
      deployResp.id,
      buildIdToDeploy
    );
  } catch (e) {
    if (e.response && e.response.status === 404) {
      logger.error(
        i18n(`${i18nKey}.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountIdentifier: uiAccountDescription(account),
          command: uiCommandReference('hs project upload'),
        })
      );
    } else if (e.response && e.response.status === 400) {
      logger.error(e.message);
    } else {
      logApiErrorInstance(
        e,
        new ApiErrorContext({ accountId: account, request: 'project deploy' })
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
      alias: ['buildId'],
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
