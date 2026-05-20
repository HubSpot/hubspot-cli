import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchProject,
  getBuildStatus,
} from '@hubspot/local-dev-lib/api/projects';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { confirmPrompt } from '../../../lib/prompts/promptUtils.js';
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
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';
import { createRelease } from '../../../api/releases.js';

const command = 'create';
// const describe = commands.project.release.create.describe;
const describe = undefined;
// const verboseDescribe = commands.project.release.create.verboseDescribe;
const verboseDescribe = undefined;

export type ProjectReleaseCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs & {
    build?: number;
    force: boolean;
  };

async function resolveBuildId(
  accountId: number,
  projectName: string,
  buildOption?: number
): Promise<number> {
  const {
    data: { deployedBuildId },
  } = await fetchProject(accountId, projectName);

  if (buildOption) {
    return buildOption;
  }

  if (!deployedBuildId) {
    throw new Error(commands.project.release.create.errors.noDeployedBuild);
  }

  return deployedBuildId;
}

async function validateBuild(
  accountId: number,
  projectName: string,
  buildId: number
): Promise<void> {
  try {
    await getBuildStatus(accountId, projectName, buildId);
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      uiLogger.error(
        commands.project.release.create.errors.buildNotFound(
          buildId,
          projectName
        )
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId,
          request: 'project release create',
        })
      );
    }
    throw e;
  }
}

async function executeRelease(
  accountId: number,
  projectName: string,
  buildId: number,
  formatOutputAsJson: boolean
): Promise<void> {
  try {
    const { data: release } = await createRelease(
      accountId,
      projectName,
      buildId
    );

    if (formatOutputAsJson) {
      uiLogger.json(release);
    } else {
      uiLogger.success(
        commands.project.release.create.success(
          release.releaseTag,
          release.buildId
        )
      );
    }
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 422) {
      uiLogger.error(
        commands.project.release.create.errors.buildNotDeployed(buildId)
      );
    } else {
      logError(
        e,
        new ApiErrorContext({
          accountId,
          request: 'project release create',
        })
      );
    }
    throw e;
  }
}

async function handler(
  args: ArgumentsCamelCase<ProjectReleaseCreateArgs>
): Promise<void> {
  const {
    exit,
    derivedAccountId,
    build: buildOption,
    json: formatOutputAsJson,
    force,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  const projectName = projectConfig.name;

  let buildId: number;

  try {
    buildId = await resolveBuildId(derivedAccountId, projectName, buildOption);
  } catch (e) {
    if (isHubSpotHttpError(e) && e.status === 404) {
      uiLogger.error(
        commands.project.release.create.errors.projectNotFound(
          derivedAccountId,
          projectName
        )
      );
    } else if (!(e instanceof Error) || !e.message) {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: 'project release create',
        })
      );
    } else {
      uiLogger.error(e.message);
    }
    return exit(EXIT_CODES.ERROR);
  }

  if (buildOption) {
    try {
      await validateBuild(derivedAccountId, projectName, buildId);
    } catch {
      return exit(EXIT_CODES.ERROR);
    }
  }

  if (!formatOutputAsJson && !force) {
    const confirmed = await confirmPrompt(
      commands.project.release.create.confirmPrompt(projectName, buildId)
    );

    if (!confirmed) {
      uiLogger.log(commands.project.release.create.cancelled);
      return exit(EXIT_CODES.SUCCESS);
    }
  }

  try {
    await executeRelease(
      derivedAccountId,
      projectName,
      buildId,
      !!formatOutputAsJson
    );
  } catch {
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectReleaseCreateBuilder(
  yargs: Argv
): Argv<ProjectReleaseCreateArgs> {
  yargs.options({
    build: {
      alias: ['build-id'],
      describe: commands.project.release.create.options.build,
      type: 'number',
    },
    force: {
      alias: ['f'],
      describe: commands.project.release.create.options.force,
      default: false,
      type: 'boolean',
    },
  });

  yargs.example([
    [
      '$0 project release create',
      commands.project.release.create.examples.default,
    ],
    [
      '$0 project release create --build=5',
      commands.project.release.create.examples.withBuild,
    ],
  ]);

  return yargs as Argv<ProjectReleaseCreateArgs>;
}

const builder = makeYargsBuilder<ProjectReleaseCreateArgs>(
  projectReleaseCreateBuilder,
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

const projectReleaseCreateCommand: YargsCommandModule<
  unknown,
  ProjectReleaseCreateArgs
> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('project-release-create', handler),
};

export default projectReleaseCreateCommand;
