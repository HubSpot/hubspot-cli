import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { getCwd, sanitizeFileName } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import {
  downloadProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { getProjectConfig } from '../../lib/projects';
import { downloadProjectPrompt } from '../../lib/prompts/downloadProjectPrompt';
import { i18n } from '../../lib/lang';
import { uiBetaTag } from '../../lib/ui';
import { trackCommandUsage } from '../../lib/usageTracking';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const i18nKey = 'commands.project.subcommands.download';

export const command = 'download';
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type ProjectDownloadArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { project?: string; dest?: string; build?: number };

export async function handler(args: ArgumentsCamelCase<ProjectDownloadArgs>) {
  const { projectConfig } = await getProjectConfig();

  if (projectConfig) {
    logger.error(i18n(`${i18nKey}.warnings.cannotDownloadWithinProject`));
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
      logger.error(i18n(`${i18nKey}.errors.noBuildIdToDownload`));
      process.exit(EXIT_CODES.ERROR);
    }

    const absoluteDestPath = dest ? path.resolve(getCwd(), dest) : getCwd();

    const { data: zippedProject } = await downloadProject(
      derivedAccountId,
      projectName,
      buildNumberToDownload!
    );

    await extractZipArchive(
      zippedProject,
      sanitizeFileName(projectName),
      path.resolve(absoluteDestPath),
      { includesRootDir: false }
    );

    logger.log(
      i18n(`${i18nKey}.logs.downloadSucceeded`, {
        buildId: buildNumberToDownload!,
        projectName,
      })
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
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    build: {
      describe: i18n(`${i18nKey}.options.build.describe`),
      alias: ['build-id'],
      type: 'number',
    },
  });

  yargs.example([
    [
      '$0 project download --project=myProject --dest=myProjectFolder',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  return yargs as Argv<ProjectDownloadArgs>;
}

export const builder = makeYargsBuilder<ProjectDownloadArgs>(
  projectDownloadBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

module.exports = {
  command,
  describe,
  builder,
  handler,
};
