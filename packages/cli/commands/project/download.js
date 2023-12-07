const path = require('path');
const chalk = require('chalk');

const {
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { logger } = require('@hubspot/cli-lib/logger');
const { extractZipArchive } = require('@hubspot/local-dev-lib/archive');
const {
  downloadProject,
  fetchProjectBuilds,
} = require('@hubspot/cli-lib/api/dfs');
const { ensureProjectExists, getProjectConfig } = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  downloadProjectPrompt,
} = require('../../lib/prompts/downloadProjectPrompt');
const { i18n } = require('../../lib/lang');
const { uiBetaTag } = require('../../lib/ui');
const { buildLogCallbacks } = require('../../lib/logCallbacks');

const i18nKey = 'cli.commands.project.subcommands.download';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const archiveLogCallbacks = buildLogCallbacks({
  init: `${i18nKey}.archiveLogCallbacks.init`,
  copy: `${i18nKey}.archiveLogCallbacks.copy`,
});

exports.command = 'download [--project]';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { projectConfig } = await getProjectConfig();

  if (projectConfig) {
    logger.error(i18n(`${i18nKey}.warnings.cannotDownloadWithinProject`));
    process.exit(EXIT_CODES.ERROR);
  }

  const { project, dest, buildNumber } = options;
  let { project: promptedProjectName } = await downloadProjectPrompt(options);
  let projectName = promptedProjectName || project;

  const accountId = getAccountId(options);

  trackCommandUsage('project-download', null, accountId);

  try {
    const projectExists = await ensureProjectExists(accountId, projectName, {
      allowCreate: false,
      noLogs: true,
    });

    if (!projectExists) {
      logger.error(
        i18n(`${i18nKey}.errors.projectNotFound`, {
          projectName: chalk.bold(projectName),
          accountId: chalk.bold(accountId),
        })
      );
      let { name: promptedProjectName } = await downloadProjectPrompt(options);
      let projectName = promptedProjectName || project;
    }

    const absoluteDestPath = dest ? path.resolve(getCwd(), dest) : getCwd();

    let buildNumberToDownload = buildNumber;

    if (!buildNumberToDownload) {
      let projectBuildsResult;

      projectBuildsResult = await fetchProjectBuilds(accountId, projectName);

      const { results: projectBuilds } = projectBuildsResult;

      if (projectBuilds && projectBuilds.length) {
        const latestBuild = projectBuilds[0];
        buildNumberToDownload = latestBuild.buildId;
      }
    }

    const zippedProject = await downloadProject(
      accountId,
      projectName,
      buildNumberToDownload
    );

    await extractZipArchive(
      zippedProject,
      projectName,
      path.resolve(absoluteDestPath),
      { includesRootDir: false },
      archiveLogCallbacks
    );

    logger.log(
      i18n(`${i18nKey}.logs.downloadSucceeded`, {
        buildId: buildNumberToDownload,
        projectName,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logApiErrorInstance(e, new ApiErrorContext({ accountId, projectName }));
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  addUseEnvironmentOptions(yargs, true);

  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    buildNumber: {
      describe: i18n(`${i18nKey}.options.buildNumber.describe`),
      type: 'number',
    },
  });

  yargs.example([
    [
      '$0 project download --project=myProject --dest=myProjectFolder',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  return yargs;
};
