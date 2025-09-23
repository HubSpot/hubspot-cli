import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import {
  downloadProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { downloadProjectPrompt } from '../../lib/prompts/downloadProjectPrompt.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'download';
const describe = commands.project.download.describe;

type ProjectDownloadArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { project?: string; dest?: string; build?: number };

async function handler(
  args: ArgumentsCamelCase<ProjectDownloadArgs>
): Promise<void> {
  const { projectConfig } = await getProjectConfig();

  if (projectConfig) {
    uiLogger.error(
      commands.project.download.warnings.cannotDownloadWithinProject
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { dest, build, derivedAccountId } = args;
  const { project: projectName } = await downloadProjectPrompt(args);
  let buildNumberToDownload = build;

  trackCommandUsage('project-download', undefined, derivedAccountId);

  try {
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
      process.exit(EXIT_CODES.ERROR);
    }

    const absoluteDestPath = dest ? path.resolve(getCwd(), dest) : getCwd();

    const { data: zippedProject } = await downloadProject(
      derivedAccountId,
      projectName,
      buildNumberToDownload
    );

    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectName),
      path.resolve(absoluteDestPath),
      { includesRootDir: false }
    );

    uiLogger.log(
      commands.project.download.logs.downloadSucceeded(
        buildNumberToDownload,
        projectName
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logError(
      e,
      new ApiErrorContext({
        accountId: derivedAccountId,
        request: 'project download',
      })
    );
    process.exit(EXIT_CODES.ERROR);
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
  }
);

const projectDownloadCommand: YargsCommandModule<unknown, ProjectDownloadArgs> =
  {
    command,
    describe,
    handler,
    builder,
  };

export default projectDownloadCommand;
