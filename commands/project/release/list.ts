import { Argv, ArgumentsCamelCase } from 'yargs';
import { listReleases } from '../../../api/releases.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { isPromptExitError } from '../../../lib/errors/PromptExitError.js';
import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { promptUser } from '../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';
import { renderTable } from '../../../ui/render.js';
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';

const command = 'list';
// const describe = commands.project.release.list.describe;
const describe = undefined;
// const verboseDescribe = commands.project.release.list.verboseDescribe;
const verboseDescribe = undefined;

export type ProjectReleaseListArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs & {
    limit?: number;
  };

async function fetchAndDisplayReleases(
  accountId: number,
  projectName: string,
  options: { limit?: number; after?: string }
): Promise<void> {
  const {
    data: { results, paging },
  } = await listReleases(accountId, projectName, options);

  uiLogger.log(
    commands.project.release.list.showingReleases(results.length, projectName)
  );

  if (results.length === 0) {
    uiLogger.log(commands.project.release.list.noReleases);
  } else {
    const rows = results.map(release => [
      release.releaseTag,
      `#${release.buildId}`,
      new Date(release.createdAt).toLocaleString(),
    ]);

    renderTable(['Release', 'Build', 'Created'], rows);
  }

  if (paging?.next?.after) {
    await promptUser({
      name: 'more',
      message: commands.project.release.list.continueOrExitPrompt,
    });
    await fetchAndDisplayReleases(accountId, projectName, {
      limit: options.limit,
      after: paging.next.after,
    });
  }
}

async function handler(
  args: ArgumentsCamelCase<ProjectReleaseListArgs>
): Promise<void> {
  const { derivedAccountId, limit, json: formatOutputAsJson } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

  const projectName = projectConfig.name;

  try {
    if (formatOutputAsJson) {
      const { data } = await listReleases(derivedAccountId, projectName, {
        limit,
      });
      uiLogger.json(data);
    } else {
      await fetchAndDisplayReleases(derivedAccountId, projectName, { limit });
    }
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    if (isHubSpotHttpError(e) && e.status === 404) {
      uiLogger.error(
        commands.project.release.list.errors.projectNotFound(
          derivedAccountId,
          projectName
        )
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: 'project release list',
        })
      );
    }
    process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function projectReleaseListBuilder(yargs: Argv): Argv<ProjectReleaseListArgs> {
  yargs.options({
    limit: {
      describe: commands.project.release.list.options.limit,
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project release list', commands.project.release.list.examples.default],
    [
      '$0 project release list --limit=5',
      commands.project.release.list.examples.withLimit,
    ],
  ]);

  return yargs as Argv<ProjectReleaseListArgs>;
}

const builder = makeYargsBuilder<ProjectReleaseListArgs>(
  projectReleaseListBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useJSONOutputOptions: true,
  }
);

const projectReleaseListCommand: YargsCommandModule<
  unknown,
  ProjectReleaseListArgs
> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('project-release-list', handler),
};

export default projectReleaseListCommand;
