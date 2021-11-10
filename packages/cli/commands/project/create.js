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
const { createProjectPrompt } = require('../lib/prompts/createProjectPrompt');
const { createProjectConfig } = require('../../lib/projects');

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

exports.command = 'create';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const { name, template, location } = await createProjectPrompt(options);

  trackCommandUsage('project-create', { projectName: name }, accountId);

  await createProjectConfig(
    path.resolve(getCwd(), options.location || location),
    options.name || name,
    options.template || template
  );
};

exports.builder = yargs => {
  yargs.options({
    name: {
      describe: 'Project name (cannot be changed)',
      type: 'string',
    },
    location: {
      describe: 'Directory where project should be created',
      type: 'string',
    },
    template: {
      describe: 'Which template?',
      type: 'string',
    },
  });

  yargs.example([['$0 project create', 'Create a project']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
