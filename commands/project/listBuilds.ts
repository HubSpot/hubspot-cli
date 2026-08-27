import { Argv, ArgumentsCamelCase } from 'yargs';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  fetchProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { uiLink } from '../../lib/ui/index.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../lib/projects/config.js';
import { getProjectDetailUrl } from '../../lib/projects/urls.js';
import moment from 'moment';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { isPromptExitError } from '../../lib/errors/PromptExitError.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { renderTable } from '../../ui/render.js';
import {
  ProjectBuildsListJsonOutput,
  ProjectBuildsListSchema,
  mapBuildToJsonOutput,
} from '../../lib/jsonOutput.js';

const command = 'list-builds';
const describe = commands.project.listBuilds.describe;

export type ProjectListBuildsArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<ProjectBuildsListJsonOutput> & {
    project?: string;
    limit?: number;
  };

async function fetchAndDisplayBuilds(
  accountId: number,
  project: Project,
  options: { limit?: number; after?: string }
): Promise<void> {
  const {
    data: { results, paging },
  } = await fetchProjectBuilds(accountId, project.name, options);
  const currentDeploy = project.deployedBuildId;

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
    renderTable(
      ['Build ID', 'Status', 'Completed', 'Duration', 'Details'],
      builds
    );
  }

  if (options.after) {
    if (results.length > 0) {
      uiLogger.log(
        commands.project.listBuilds.showingNextBuilds(
          results.length,
          project.name
        )
      );
    }
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

  const canPromptForMore =
    options.limit === undefined && Boolean(process.stdin.isTTY);

  if (paging?.next?.after && canPromptForMore) {
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
  const {
    project: projectFlagValue,
    limit,
    derivedAccountId,
    exit,
    json: formatOutputAsJson,
    addJsonOutput,
  } = args;

  let projectName = projectFlagValue;

  if (!projectName) {
    const { projectConfig, projectDir } = await getProjectConfig();

    try {
      validateProjectConfig(projectConfig, projectDir);
    } catch (error) {
      logError(error);
      return exit(EXIT_CODES.ERROR);
    }

    if (!projectConfig) {
      return exit(EXIT_CODES.ERROR);
    }
    projectName = projectConfig.name;
  }

  try {
    const { data: project } = await fetchProject(derivedAccountId, projectName);

    if (formatOutputAsJson) {
      const {
        data: { results, paging },
      } = await fetchProjectBuilds(derivedAccountId, project.name, { limit });

      addJsonOutput({
        projectName: project.name,
        deployedBuildId: project.deployedBuildId,
        results: results.map(build =>
          mapBuildToJsonOutput(build, project.deployedBuildId)
        ),
        paging: paging?.next?.after
          ? { next: { after: paging.next.after } }
          : undefined,
      });
    } else {
      await fetchAndDisplayBuilds(derivedAccountId, project, { limit });
    }
  } catch (e) {
    if (isPromptExitError(e)) {
      return exit(e.exitCode);
    }
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
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectListBuildsBuilder(yargs: Argv): Argv<ProjectListBuildsArgs> {
  yargs.options({
    project: {
      describe: commands.project.listBuilds.options.project.describe,
      type: 'string',
    },
    limit: {
      describe: commands.project.listBuilds.options.limit.describe,
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project list-builds', commands.project.listBuilds.examples.default],
    [
      '$0 project list-builds --limit=5',
      commands.project.listBuilds.examples.withLimit,
    ],
    [
      '$0 project list-builds --json',
      commands.project.listBuilds.examples.json,
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
    useJSONOutputOptions: true,
  }
);

const projectListBuildsCommand: YargsCommandModule<
  unknown,
  ProjectListBuildsArgs
> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('project-list-builds', handler, {
    jsonOutputSchema: ProjectBuildsListSchema,
  }),
  builder,
};

export default projectListBuildsCommand;
