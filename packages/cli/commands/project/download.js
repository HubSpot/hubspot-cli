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
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.download';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'download <name> [dest]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name: projectName, dest, buildNumber } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-download', null, accountId);

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
    process.exit(EXIT_CODES.ERROR);
  }

  const absoluteDestPath = dest ? path.resolve(getCwd(), dest) : getCwd();

  const projectConfigCreated = await createProjectConfig(
    absoluteDestPath,
    projectName,
    'no-template'
  );

  if (!projectConfigCreated) {
    logger.log(i18n(`${i18nKey}.logs.downloadCancelled`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  let success = false;
  let buildNumberToDownload = buildNumber;

  if (!buildNumberToDownload) {
    let projectBuildsResult;

    try {
      projectBuildsResult = await fetchProjectBuilds(accountId, projectName);
    } catch (e) {
      logApiErrorInstance(e, new ApiErrorContext({ accountId }));
      process.exit(EXIT_CODES.ERROR);
    }

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

  success = await extractZipArchive(
    zippedProject,
    projectName,
    path.resolve(absoluteDestPath, 'src'),
    {
      includesRootDir: false,
    }
  );

  if (!success) {
    logger.log(i18n(`${i18nKey}.errors.downloadFailed`));
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log(
    i18n(`${i18nKey}.logs.downloadSucceeded`, {
      buildId: buildNumberToDownload,
      projectName,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });
  yargs.positional('dest', {
    describe: i18n(`${i18nKey}.positionals.dest.describe`),
    type: 'string',
  });
  yargs.option('buildNumber', {
    describe: i18n(`${i18nKey}.options.buildNumber.describe`),
    type: 'number',
  });
  yargs.example([
    [
      '$0 project download myProject myProjectFolder',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);
  return yargs;
};
