const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { deployProject } = require('@hubspot/cli-lib/api/fileMapper');
const { validateAccount } = require('../../lib/validation');
const { prompt } = require('inquirer');
const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'init [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('projects-init', { projectPath }, accountId);

  const promptIfEmpty = async requiredOptions => {
    for (const option of requiredOptions) {
      if (!options[option]) {
        const answer = await prompt({ name: option });
        options[option] = answer[option];
      }
    }
  };
  await promptIfEmpty(['label', 'description']);

  logger.log('label', options.label);
  logger.log('description', options.description);

  logger.debug(`Initializing project at path: ${projectPath}`);

  try {
    const deployResp = await deployProject(accountId, projectPath);

    if (deployResp.error) {
      logger.error(`Deploy error: ${deployResp.error.message}`);
      return;
    }

    logger.success(
      `Deployed project in ${projectPath} on account ${accountId}.`
    );
  } catch (e) {
    if (e.statusCode === 400) {
      logger.error(e.error.message);
    } else {
      logApiErrorInstance(
        accountId,
        e,
        new ApiErrorContext({ accountId, projectPath })
      );
    }
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.options({
    label: {
      describe: 'Project label',
      type: 'string',
    },
    description: {
      describe: 'Description of project',
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 projects init myProjectFolder',
      'Initialize a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
