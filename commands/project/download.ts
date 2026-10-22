import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  downloadProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { isPromptExitError } from '../../lib/errors/PromptExitError.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import {
  archiveDestExists,
  moveSourceToProjectArchive,
} from '../../lib/projects/archive.js';
import {
  describeArchiveLocation,
  extractBuild,
  getDisplayPath,
  getLocalProject,
  handleArchivedSource,
  resolveDownloadDestination,
} from '../../lib/projects/download.js';
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
    force?: boolean;
    keepLocalFiles?: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<ProjectDownloadArgs>
): Promise<void> {
  const {
    project: projectArg,
    dest,
    build,
    force,
    keepLocalFiles,
    derivedAccountId,
    formatOutputAsJson,
    exit,
    addJsonOutput,
  } = args;

  let buildNumberToDownload = build;

  try {
    const localProject = getLocalProject();
    const { project: projectName } = await downloadProjectPrompt({
      ...args,
      project: projectArg || localProject?.projectName,
    });

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

    const { absoluteDestPath, archivePlan } = resolveDownloadDestination({
      projectName,
      dest,
      localProject,
    });

    if (archivePlan && archiveDestExists(archivePlan.archiveDest)) {
      uiLogger.error(
        commands.project.download.errors.archiveAlreadyExists(
          getDisplayPath(archivePlan.archiveDest)
        )
      );
      return exit(EXIT_CODES.ERROR);
    }

    if (archivePlan && !force && !formatOutputAsJson) {
      uiLogger.warn(
        commands.project.download.warnings.sourceWillBeArchived(
          describeArchiveLocation(archivePlan)
        )
      );
      uiLogger.log('');
      const confirmed = await confirmPrompt(
        commands.project.download.prompts.confirmDownload(
          buildNumberToDownload,
          projectName
        ),
        { defaultAnswer: false }
      );

      if (!confirmed) {
        uiLogger.log(commands.project.download.logs.downloadCancelled);
        return exit(EXIT_CODES.SUCCESS);
      }
    }

    const { data: zippedProject } = await downloadProject(
      derivedAccountId,
      projectName,
      buildNumberToDownload
    );

    if (archivePlan) {
      moveSourceToProjectArchive(archivePlan.projectDir, archivePlan.srcDir);
    }

    await extractBuild({
      zippedProject,
      projectName,
      absoluteDestPath,
      archivePlan,
    });

    if (archivePlan) {
      await handleArchivedSource({
        archivePlan,
        keepLocalFiles,
        canPrompt: !force && !formatOutputAsJson,
      });
    }

    addJsonOutput({
      projectName,
      buildId: buildNumberToDownload,
      dest: absoluteDestPath,
      archiveDest: archivePlan?.archiveDest,
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
    force: {
      describe: commands.project.download.options.force.describe,
      type: 'boolean',
    },
    'keep-local-files': {
      describe: commands.project.download.options.keepLocalFiles.describe,
      type: 'boolean',
    },
  });

  yargs.example([
    [
      '$0 project download --project=myProject --dest=myProjectFolder',
      commands.project.download.examples.default,
    ],
    [
      '$0 project download --build=3',
      commands.project.download.examples.currentProject,
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
