const path = require('path');

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
const {
  fetchProject,
  fetchProjectBuilds,
} = require('@hubspot/cli-lib/api/dfs');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');
const { getCwd } = require('@hubspot/cli-lib/path');
const { uiLink } = require('../../lib/ui');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  getProjectConfig,
  getProjectDetailUrl,
  validateProjectConfig,
} = require('../../lib/projects');
const moment = require('moment');
const { promptUser } = require('../../lib/prompts/promptUtils');

exports.command = 'list-builds [path]';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { path: projectPath, limit } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-list-builds', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();
  const { projectConfig, projectDir } = await getProjectConfig(cwd);

  validateProjectConfig(projectConfig, projectDir);

  logger.debug(`Fetching builds for project at path: ${projectPath}`);

  const fetchAndDisplayBuilds = async (project, options) => {
    const { results, paging } = await fetchProjectBuilds(
      accountId,
      project.name,
      options
    );
    const currentDeploy = project.deployedBuildId;
    if (options && options.after) {
      logger.log(
        `Showing the next ${results.length} builds for ${project.name}`
      );
    } else {
      logger.log(
        `Showing the ${results.length} most recent builds for ${project.name}. ` +
          uiLink(
            'View all builds in project details.',
            getProjectDetailUrl(project.name, accountId)
          )
      );
    }

    if (results.length === 0) {
      logger.log('No builds found.');
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
        message: 'Press <enter> to load more, or ctrl+c to exit',
      });
      await fetchAndDisplayBuilds(project, { limit, after: paging.next.after });
    }
  };

  try {
    const project = await fetchProject(accountId, projectConfig.name);

    await fetchAndDisplayBuilds(project, { limit });
  } catch (e) {
    if (e.statusCode === 404) {
      logger.error(`Project ${projectConfig.name} not found. `);
    } else {
      logApiErrorInstance(e, new ApiErrorContext({ accountId }));
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.options({
    limit: {
      describe: 'Max number of builds to load',
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project list-builds myProjectFolder',
      'Fetch a list of builds for a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
