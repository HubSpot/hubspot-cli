import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import {
  downloadProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { isPromptExitError } from '../../lib/errors/PromptExitError.js';
import { getIsInProject } from '../../lib/projects/config.js';
import { downloadProjectPrompt } from '../../lib/prompts/downloadProjectPrompt.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import {
  ProjectDownloadJsonOutput,
  ProjectDownloadSchema,
} from '../../lib/jsonOutput/projectDownload.js';

const command = 'download';
const describe = commands.project.download.describe;

export type ProjectDownloadArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<ProjectDownloadJsonOutput> & {
    project?: string;
    dest?: string;
    build?: number;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectDownloadArgs>
): Promise<void> {
  const { dest, build, derivedAccountId, exit, addJsonOutput } = args;

  const isInProjectDir = getIsInProject();

  if (isInProjectDir) {
    uiLogger.error(
      commands.project.download.warnings.cannotDownloadWithinProject
    );
    return exit(EXIT_CODES.ERROR);
  }
  let buildNumberToDownload = build;

  try {
    const { project: projectName } = await downloadProjectPrompt(args);
    if (!buildNumberToDownload) {
      const { data: projectBuildsResult } = await fetchProjectBuilds(
        derivedAccountId,
        projectName
      );

      const { results: projectBuilds } = projectBuildsResult;

      if (projectBuilds && projectBuilds.length) {
        const latestBuild = projectBuilds[0];
        buildNumberToDownload = latestBuild.buildId;
      }
    }

    if (!buildNumberToDownload) {
      uiLogger.error(commands.project.download.errors.noBuildIdToDownload);
      return exit(EXIT_CODES.ERROR);
    }

    const sanitizedProjectName = sanitizeFileName(projectName);

    const absoluteDestPath = dest
      ? path.resolve(getCwd(), dest, sanitizedProjectName)
      : path.resolve(getCwd(), sanitizedProjectName);

    const { data: zippedProject } = await downloadProject(
      derivedAccountId,
      projectName,
      buildNumberToDownload
    );

    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectName),
      path.resolve(absoluteDestPath)
    );

    addJsonOutput({
      projectName,
      buildId: buildNumberToDownload,
      dest: absoluteDestPath,
    });

    uiLogger.log(
      commands.project.download.logs.downloadSucceeded(
        buildNumberToDownload,
        projectName
      )
    );
    return exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    logError(
      e,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: 'project download',
      })
    );
    return exit(EXIT_CODES.ERROR);
  }
}

function projectDownloadBuilder(yargs: Argv): Argv<ProjectDownloadArgs> {
  yargs.options({
    project: {
      describe: commands.project.download.options.project.describe,
      type: 'string',
    },
    dest: {
      describe: commands.project.download.options.dest.describe,
      type: 'string',
    },
    build: {
      describe: commands.project.download.options.build.describe,
      alias: ['build-id'],
      type: 'number',
    },
  });

  yargs.example([
    [
      '$0 project download --project=myProject --dest=myProjectFolder',
      commands.project.download.examples.default,
    ],
    [
      '$0 project download --project=myProject --json',
      commands.project.download.examples.json,
    ],
  ]);

  return yargs as Argv<ProjectDownloadArgs>;
}

const builder = makeYargsBuilder<ProjectDownloadArgs>(
  projectDownloadBuilder,
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

const projectDownloadCommand: YargsCommandModule<unknown, ProjectDownloadArgs> =
  {
    command,
    describe,
    handler: makeWrappedYargsHandler('project-download', handler, {
      jsonOutputSchema: ProjectDownloadSchema,
    }),
    builder,
  };

export default projectDownloadCommand;
