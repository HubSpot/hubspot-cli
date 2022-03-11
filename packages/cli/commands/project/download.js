const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
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

exports.command = 'download [name] [location]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name: projectName, location } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-download', { projectName }, accountId);

  await ensureProjectExists(accountId, projectName, { allowCreate: false });

  const projectConfigCreated = await createProjectConfig(
    location,
    projectName,
    'none'
  );

  if (!projectConfigCreated) {
    logger.log('Aborting download');
    process.exit(EXIT_CODES.SUCCESS);
  }

  let success = false;
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

    const zippedProject = await downloadProject(
      accountId,
      projectName,
      latestBuild.buildId
    );

    success = await extractZipArchive(
      zippedProject,
      projectName,
      `${location}/src`,
      { includesRootDir: false }
    );
  }

  if (!success) {
    logger.log('Something went wrong downloading the project');
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log('Successfully downloaded project');
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.positional('location', {
    describe: i18n(`${i18nKey}.positionals.location.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 project download myProject myProjectFolder',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
