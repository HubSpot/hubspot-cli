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
const { validateAccount } = require('../../lib/validation');
const { getCwd } = require('@hubspot/cli-lib/path');
const path = require('path');
const {
  createProjectConfig,
  showWelcomeMessage,
} = require('../../lib/projects');

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

exports.command = 'create [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath, name } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-create', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();

  const projectConfig = await createProjectConfig(cwd, name);

  showWelcomeMessage(projectConfig.name, accountId);
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });
  yargs.options({
    name: {
      describe: 'Project name (cannot be changed)',
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project create myProjectFolder',
      'Create a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
