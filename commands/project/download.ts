// @ts-nocheck
const path = require('path');
const chalk = require('chalk');

const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { getCwd, sanitizeFileName } = require('@hubspot/local-dev-lib/path');
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { extractZipArchive } = require('@hubspot/local-dev-lib/archive');
const {
  downloadProject,
  fetchProjectBuilds,
} = require('@hubspot/local-dev-lib/api/projects');
const { ensureProjectExists, getProjectConfig } = require('../../lib/projects');
const {
  downloadProjectPrompt,
} = require('../../lib/prompts/downloadProjectPrompt');
const { i18n } = require('../../lib/lang');
const { uiBetaTag } = require('../../lib/ui');

const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'download';
exports.describe = uiBetaTag(i18n(`commands.project.subcommands.download.describe`), false);

exports.handler = async options => {
  const { projectConfig } = await getProjectConfig();

  if (projectConfig) {
    logger.error(i18n(`commands.project.subcommands.download.warnings.cannotDownloadWithinProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  const { project, dest, build, derivedAccountId } = options;
  const { project: promptedProjectName } = await downloadProjectPrompt(options);
  let projectName = promptedProjectName || project;

  trackCommandUsage('project-download', null, derivedAccountId);

  try {
    const { projectExists } = await ensureProjectExists(
      derivedAccountId,
      projectName,
      {
        allowCreate: false,
        noLogs: true,
      }
    );

    if (!projectExists) {
      logger.error(
        i18n(`commands.project.subcommands.download.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountId: chalk.bold(derivedAccountId),
        })
      );
      const { name: promptedProjectName } =
        await downloadProjectPrompt(options);
      projectName = promptedProjectName || project;
    }

    const absoluteDestPath = dest ? path.resolve(getCwd(), dest) : getCwd();

    let buildNumberToDownload = build;

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

    logger.log(
      i18n(`commands.project.subcommands.download.logs.downloadSucceeded`, {
        buildId: buildNumberToDownload,
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
};

exports.builder = yargs => {
  addAccountOptions(yargs);
  addConfigOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.options({
    project: {
      describe: i18n(`commands.project.subcommands.download.options.project.describe`),
      type: 'string',
    },
    dest: {
      describe: i18n(`commands.project.subcommands.download.options.dest.describe`),
      type: 'string',
    },
    build: {
      describe: i18n(`commands.project.subcommands.download.options.build.describe`),
      alias: ['build-id'],
      type: 'number',
    },
  });

  yargs.example([
    [
      '$0 project download --project=myProject --dest=myProjectFolder',
      i18n(`commands.project.subcommands.download.examples.default`),
    ],
  ]);

  return yargs;
};
