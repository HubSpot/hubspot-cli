import { Argv, ArgumentsCamelCase } from 'yargs';
import { handleProjectUpload } from '../../../lib/projects/upload.js';
import { pollProjectBuildAndDeploy } from '../../../lib/projects/pollProjectBuildAndDeploy.js';
import {
  resolveBuildId,
  validateBuildForRelease,
  executeRelease,
} from '../../../lib/projects/release.js';
import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import { isPromptExitError } from '../../../lib/errors/PromptExitError.js';
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
import { ProjectPollResult } from '../../../types/Projects.js';
import {
  ReleaseJsonOutput,
  ReleaseSchema,
  mapReleaseToJsonOutput,
} from '../../../lib/jsonOutput.js';

const command = 'create';
// const describe = commands.project.release.create.describe;
const describe = undefined;
// const verboseDescribe = commands.project.release.create.verboseDescribe;
const verboseDescribe = undefined;

export type ProjectReleaseCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<ReleaseJsonOutput> & {
    build?: number;
    force: boolean;
  };

function logUploadError(error: unknown, accountId: number): void {
  if (!error) {
    return;
  }
  logError(
    error,
    new ApiErrorContext({
      accountId,
      request: 'project release create',
    })
  );
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
    addJsonOutput,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  if (!projectConfig || !projectDir) {
    return exit(EXIT_CODES.ERROR);
  }

  const projectName = projectConfig.name;

  let buildId: number | null | undefined;

  try {
    buildId = await resolveBuildId(
      derivedAccountId,
      projectName,
      buildOption,
      force
    );
  } catch (e) {
    if (isPromptExitError(e)) {
      return exit(e.exitCode);
    }
    logError(
      e,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: 'project release create',
      })
    );
    return exit(EXIT_CODES.ERROR);
  }

  if (buildId === null) {
    return exit(EXIT_CODES.ERROR);
  }

  if (!buildId && !force) {
    let shouldUpload: boolean;
    try {
      shouldUpload = await confirmPrompt(
        commands.project.release.create.uploadPrompt(projectName)
      );
    } catch (e) {
      if (isPromptExitError(e)) {
        return exit(e.exitCode);
      }
      throw e;
    }
    if (!shouldUpload) {
      return exit(EXIT_CODES.SUCCESS);
    }
  }

  if (!buildId) {
    const {
      result: pollResult,
      uploadError,
      projectNotFound,
    } = await handleProjectUpload<ProjectPollResult>({
      accountId: derivedAccountId,
      projectConfig,
      projectDir,
      sendIR: true,
      callbackFunc: (...args) =>
        pollProjectBuildAndDeploy(...args, { skipDeploy: true }),
    });

    if (projectNotFound || !pollResult || !pollResult.succeeded) {
      logUploadError(uploadError, derivedAccountId);
      return exit(EXIT_CODES.ERROR);
    }

    buildId = pollResult.buildId;
  }

  try {
    const supportsReleases = await validateBuildForRelease(
      derivedAccountId,
      projectName,
      buildId
    );

    if (!supportsReleases) {
      uiLogger.error(
        commands.project.release.create.errors.incompatibleBuildVersion
      );
      return exit(EXIT_CODES.ERROR);
    }
  } catch {
    return exit(EXIT_CODES.ERROR);
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
    const release = await executeRelease(
      derivedAccountId,
      projectName,
      buildId
    );
    addJsonOutput(mapReleaseToJsonOutput(release));
    if (!formatOutputAsJson) {
      uiLogger.success(
        commands.project.release.create.success(
          release.releaseTag,
          release.buildId
        )
      );
    }
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
  handler: makeWrappedYargsHandler('project-release-create', handler, {
    jsonOutputSchema: ReleaseSchema,
  }),
};

export default projectReleaseCreateCommand;
