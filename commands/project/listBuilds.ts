import { Argv, ArgumentsCamelCase } from 'yargs';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  fetchProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { getTableContents, getTableHeader } from '../../lib/ui/table.js';
import { uiLink } from '../../lib/ui/index.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { getProjectDetailUrl } from '../../lib/projects/urls.js';
import moment from 'moment';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'list-builds';
const describe = commands.project.listBuilds.describe;

type ProjectListBuildsArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { project?: string; limit?: number };

async function fetchAndDisplayBuilds(
  accountId: number,
  project: Project,
  options: { limit?: number; after?: string }
): Promise<void> {
  const {
    data: { results, paging },
  } = await fetchProjectBuilds(accountId, project.name, options);
  const currentDeploy = project.deployedBuildId;
  if (options && options.after) {
    uiLogger.log(
      commands.project.listBuilds.showingNextBuilds(
        results.length,
        project.name
      )
    );
  } else {
    uiLogger.log(
      commands.project.listBuilds.showingRecentBuilds(
        results.length,
        project.name,
        uiLink(
          commands.project.listBuilds.viewAllBuildsLink,
          getProjectDetailUrl(project.name, accountId)!
        )
      )
    );
  }

  if (results.length === 0) {
    uiLogger.log(commands.project.listBuilds.errors.noBuilds);
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
      getTableHeader(['Build ID', 'Status', 'Completed', 'Duration', 'Details'])
    );
    uiLogger.log(
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
      message: commands.project.listBuilds.continueOrExitPrompt,
    });
    await fetchAndDisplayBuilds(accountId, project, {
      limit: options.limit,
      after: paging.next.after,
    });
  }
}

async function handler(
  args: ArgumentsCamelCase<ProjectListBuildsArgs>
): Promise<void> {
  const { project: projectFlagValue, limit, derivedAccountId } = args;

  trackCommandUsage('project-list-builds', undefined, derivedAccountId);

  let projectName = projectFlagValue;

  if (!projectName) {
    const { projectConfig, projectDir } = await getProjectConfig();
    validateProjectConfig(projectConfig, projectDir);
    projectName = projectConfig.name;
  }

  try {
    const { data: project } = await fetchProject(derivedAccountId, projectName);
    await fetchAndDisplayBuilds(derivedAccountId, project, { limit });
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      uiLogger.error(
        commands.project.listBuilds.errors.projectNotFound(projectName)
      );
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
  process.exit(EXIT_CODES.SUCCESS);
}

function projectListBuildsBuilder(yargs: Argv): Argv<ProjectListBuildsArgs> {
  yargs.options({
    project: {
      describe: commands.project.listBuilds.options.project.describe,
      type: 'string',
    },
    limit: {
      describe: commands.project.listBuilds.options.limit.describe,
      type: 'string',
    },
  });

  yargs.example([
    ['$0 project list-builds', commands.project.listBuilds.examples.default],
  ]);

  return yargs as Argv<ProjectListBuildsArgs>;
}

const builder = makeYargsBuilder<ProjectListBuildsArgs>(
  projectListBuildsBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const projectListBuildsCommand: YargsCommandModule<
  unknown,
  ProjectListBuildsArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default projectListBuildsCommand;
