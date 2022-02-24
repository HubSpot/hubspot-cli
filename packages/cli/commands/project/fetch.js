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
const { fetchProject } = require('@hubspot/cli-lib/api/dfs');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.deploy';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'fetch [name] [path]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name: projectName, path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-fetch', { projectName }, accountId);

  try {
    const project = await fetchProject(accountId, projectName);
    console.log('success!, ', project, projectPath);
  } catch (e) {
    if (e.statusCode === 404) {
      logger.error(`Project ${projectName} not found. `);
    } else {
      logApiErrorInstance(e, new ApiErrorContext({ accountId }));
    }
    process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 project fetch myProject myProjectFolder',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
