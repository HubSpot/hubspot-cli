import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { handleProjectUpload } from '../../../lib/projects/upload.js';
import { pollProjectBuildAndDeploy } from '../../../lib/projects/pollProjectBuildAndDeploy.js';
import { resolveBuildId } from '../../../lib/projects/release.js';
import { triggerAndPollPreview } from '../../../lib/projects/preview.js';
import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import { isPromptExitError } from '../../../lib/errors/PromptExitError.js';
import { getProjectConfig } from '../../../lib/projects/config.js';
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
  ProjectReleasePreviewJsonOutput,
  ProjectReleasePreviewSchema,
} from '../../../lib/jsonOutput/projectRelease.js';

const command = 'preview';
// const describe = commands.project.release.preview.describe;
const describe = undefined;
// const verboseDescribe = commands.project.release.preview.verboseDescribe;
const verboseDescribe = undefined;

export type ProjectReleasePreviewArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<ProjectReleasePreviewJsonOutput> & {
    build?: number;
    target: number;
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
      request: 'project release preview',
    })
  );
}

async function handler(
  args: ArgumentsCamelCase<ProjectReleasePreviewArgs>
): Promise<void> {
  const {
    exit,
    derivedAccountId,
    build: buildOption,
    target: targetPortalId,
    json: formatOutputAsJson,
    force,
    addJsonOutput,
  } = args;

  let projectConfig;
  let projectDir;

  try {
    ({ projectConfig, projectDir } = getProjectConfig());
  } catch (error) {
    logError(error);
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
        request: 'project release preview',
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
        commands.project.release.preview.uploadPrompt(projectName)
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

  let projectId: number | undefined;

  if (!buildId) {
    const {
      result: pollResult,
      uploadError,
      projectNotFound,
      projectId: uploadedProjectId,
    } = await handleProjectUpload<ProjectPollResult>({
      accountId: derivedAccountId,
      projectConfig,
      projectDir,
      sendIR: true,
      forceCreate: force,
      force,
      callbackFunc: (...args) =>
        pollProjectBuildAndDeploy(...args, { skipDeploy: true }),
    });

    if (projectNotFound || !pollResult || !pollResult.succeeded) {
      logUploadError(uploadError, derivedAccountId);
      return exit(EXIT_CODES.ERROR);
    }

    buildId = pollResult.buildId;
    projectId = uploadedProjectId;
  }

  if (!projectId) {
    try {
      const { data } = await fetchProject(derivedAccountId, projectName);
      projectId = data.id;
    } catch (e) {
      logError(
        e,
        new ApiErrorContext({
          accountId: derivedAccountId,
          request: 'project release preview',
        })
      );
      return exit(EXIT_CODES.ERROR);
    }
  }

  const previewResult = await triggerAndPollPreview(
    derivedAccountId,
    projectId,
    buildId,
    targetPortalId
  );

  addJsonOutput({
    buildId,
    targetPortalId,
    releaseTag: previewResult.releaseTag,
    succeeded: previewResult.succeeded,
  });

  if (!previewResult.succeeded) {
    if (!formatOutputAsJson) {
      uiLogger.error(commands.project.release.preview.errors.previewFailed);
    }
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectReleasePreviewBuilder(
  yargs: Argv
): Argv<ProjectReleasePreviewArgs> {
  yargs.options({
    build: {
      alias: ['build-id'],
      describe: commands.project.release.preview.options.build,
      type: 'number',
    },
    target: {
      describe: commands.project.release.preview.options.target,
      type: 'number',
      requiresArg: true,
      demandOption: commands.project.release.preview.errors.targetRequired,
    },
    force: {
      alias: ['f'],
      describe: commands.project.release.preview.options.force,
      default: false,
      type: 'boolean',
    },
  });

  yargs.example([
    [
      '$0 project release preview --target=12345',
      commands.project.release.preview.examples.default,
    ],
    [
      '$0 project release preview --build=5 --target=12345',
      commands.project.release.preview.examples.withBuild,
    ],
  ]);

  return yargs as Argv<ProjectReleasePreviewArgs>;
}

const builder = makeYargsBuilder<ProjectReleasePreviewArgs>(
  projectReleasePreviewBuilder,
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

const projectReleasePreviewCommand: YargsCommandModule<
  unknown,
  ProjectReleasePreviewArgs
> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('project-release-preview', handler, {
    jsonOutputSchema: ProjectReleasePreviewSchema,
  }),
};

export default projectReleasePreviewCommand;
