const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  setConfig,
  writeConfig,
} = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  getAccountId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');

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

exports.command = 'default';
exports.describe = 'Change default portal used in config';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('functions-default', {}, accountId);

  const config = getConfig();
  const { default: newDefault } = await inquirer.prompt([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: 'Select a portal to use as the defaultPortal',
      choices: config.portals.map(p => p.name || p.portalId),
      default: config.defaultPortal,
    },
  ]);
  config.defaultPortal = newDefault;
  setConfig(config);
  writeConfig();

  return logger.log(`Default portal updated to: ${newDefault}`);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
};
