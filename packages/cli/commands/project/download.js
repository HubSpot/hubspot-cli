const path = require('path');
const chalk = require('chalk');

const {
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { getCwd } = require('@hubspot/cli-lib/path');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { extractZipArchive } = require('@hubspot/cli-lib/archive');
const {
  downloadProject,
  fetchProjectBuilds,
} = require('@hubspot/cli-lib/api/dfs');
const {
  createProjectConfig,
  ensureProjectExists,
} = require('../../lib/projects');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  downloadProjectPrompt,
} = require('../../lib/prompts/downloadProjectPrompt');
const { i18n } = require('../../lib/lang');

const i18nKey = 'cli.commands.project.subcommands.download';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'download [--project]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

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

    const projectConfigCreated = await createProjectConfig(
      absoluteDestPath,
      projectName,
      { name: 'no-template' }
    );

    if (!projectConfigCreated) {
      logger.log(i18n(`${i18nKey}.logs.downloadCancelled`));
      process.exit(EXIT_CODES.SUCCESS);
    }

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
      path.resolve(absoluteDestPath, 'src'),
      {
        includesRootDir: false,
      }
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
