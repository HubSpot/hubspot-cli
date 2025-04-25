import { Argv, ArgumentsCamelCase } from 'yargs';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  fetchProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { getTableContents, getTableHeader } from '../../lib/ui/table';
import { uiBetaTag, uiLink } from '../../lib/ui';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config';
import { getProjectDetailUrl } from '../../lib/projects/urls';
import moment from 'moment';
import { promptUser } from '../../lib/prompts/promptUtils';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'list-builds';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.listBuilds.describe`),
  false
);

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
    logger.log(
      i18n(`commands.project.subcommands.listBuilds.logs.showingNextBuilds`, {
        count: results.length,
        projectName: project.name,
      })
    );
  } else {
    logger.log(
      i18n(`commands.project.subcommands.listBuilds.logs.showingRecentBuilds`, {
        count: results.length,
        projectName: project.name,
        viewBuildsLink: uiLink(
          i18n(
            `commands.project.subcommands.listBuilds.logs.viewAllBuildsLink`
          ),
          getProjectDetailUrl(project.name, accountId)!
        ),
      })
    );
  }

  if (results.length === 0) {
    logger.log(i18n(`commands.project.subcommands.listBuilds.errors.noBuilds`));
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
      message: i18n(
        `commands.project.subcommands.listBuilds.continueOrExitPrompt`
      ),
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
      logger.error(
        i18n(`commands.project.subcommands.listBuilds.errors.projectNotFound`, {
          projectName,
        })
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
      describe: i18n(
        `commands.project.subcommands.listBuilds.options.project.describe`
      ),
      type: 'string',
    },
    limit: {
      describe: i18n(
        `commands.project.subcommands.listBuilds.options.limit.describe`
      ),
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project list-builds',
      i18n(`commands.project.subcommands.listBuilds.examples.default`),
    ],
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
