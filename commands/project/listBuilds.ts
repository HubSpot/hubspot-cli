// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  fetchProject,
  fetchProjectBuilds,
} = require('@hubspot/local-dev-lib/api/projects');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');
const { uiBetaTag, uiLink } = require('../../lib/ui');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  getProjectConfig,
  getProjectDetailUrl,
  validateProjectConfig,
} = require('../../lib/projects');
const moment = require('moment');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { isHubSpotHttpError } = require('@hubspot/local-dev-lib/errors/index');

const i18nKey = 'commands.project.subcommands.listBuilds';

exports.command = 'list-builds';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { project: projectFlagValue, limit, derivedAccountId } = options;

  trackCommandUsage('project-list-builds', null, derivedAccountId);

  let projectName = projectFlagValue;

  if (!projectName) {
    const { projectConfig, projectDir } = await getProjectConfig();
    validateProjectConfig(projectConfig, projectDir);
    projectName = projectConfig.name;
  }

  const fetchAndDisplayBuilds = async (project, options) => {
    const {
      data: { results, paging },
    } = await fetchProjectBuilds(derivedAccountId, project.name, options);
    const currentDeploy = project.deployedBuildId;
    if (options && options.after) {
      logger.log(
        i18n(`${i18nKey}.logs.showingNextBuilds`, {
          count: results.length,
          projectName: project.name,
        })
      );
    } else {
      logger.log(
        i18n(`${i18nKey}.logs.showingRecentBuilds`, {
          count: results.length,
          projectName: project.name,
          viewBuildsLink: uiLink(
            i18n(`${i18nKey}.logs.viewAllBuildsLink`),
            getProjectDetailUrl(project.name, derivedAccountId)
          ),
        })
      );
    }

    if (results.length === 0) {
      logger.log(i18n(`${i18nKey}.errors.noBuilds`));
    } else {
      const builds = results.map(build => {
        const isCurrentlyDeployed = build.buildId === currentDeploy;

        return [
          isCurrentlyDeployed
            ? `#${build.buildId} [deployed]`
            : `#${build.buildId}`,
          build.status,
          moment(build.finishedAt).format('MM/DD/YY, hh:mm:ssa'),
          Math.round(
            moment
              .duration(moment(build.finishedAt).diff(moment(build.enqueuedAt)))
              .asSeconds()
          ) + 's',
          build.subbuildStatuses
            .filter(subbuild => subbuild.status === 'FAILURE')
            .map(subbuild => `${subbuild.buildName} failed`)
            .join(', '),
        ];
      });
      builds.unshift(
        getTableHeader([
          'Build ID',
          'Status',
          'Completed',
          'Duration',
          'Details',
        ])
      );
      logger.log(
        getTableContents(builds, {
          columnDefault: {
            paddingLeft: 3,
          },
        })
      );
    }
    if (paging && paging.next) {
      await promptUser({
        name: 'more',
        message: i18n(`${i18nKey}.continueOrExitPrompt`),
      });
      await fetchAndDisplayBuilds(project, { limit, after: paging.next.after });
    }
  };

  try {
    const { data: project } = await fetchProject(derivedAccountId, projectName);

    await fetchAndDisplayBuilds(project, { limit });
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      logger.error(i18n(`${i18nKey}.errors.projectNotFound`, { projectName }));
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          projectName,
        })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
    limit: {
      describe: i18n(`${i18nKey}.options.limit.describe`),
      type: 'string',
    },
  });

  yargs.example([
    ['$0 project list-builds', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
