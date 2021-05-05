const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  getConfigPath,
  updateDefaultAccount,
} = require('@hubspot/cli-lib/lib/config');
const inquirer = require('inquirer');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const { getAccountId, setLogLevel } = require('../../../lib/commonOpts');
const { trackCommandUsage } = require('../../../lib/usageTracking');
const { logDebugInfo } = require('../../../lib/debugInfo');
const { validateAccount } = require('../../../lib/validation');

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

const selectAccountFromConfig = async config => {
  const { default: selectedDefault } = await inquirer.prompt([
    {
      type: 'list',
      look: false,
      name: 'default',
      pageSize: 20,
      message: 'Select an account to use as the default',
      choices: config.portals.map(p => p.name || p.portalId),
      default: config.defaultPortal,
    },
  ]);

  return selectedDefault;
};

exports.command = 'default-account [newDefault]';
exports.describe = 'Change default account used in config';

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const config = getConfig();
  const configPath = getConfigPath();
  const { newDefault: specifiedNewDefault } = options;
  let newDefault;

  trackCommandUsage('config-set-default-account', {}, accountId);

  if (!specifiedNewDefault) {
    newDefault = await selectAccountFromConfig(config);
  } else if (
    specifiedNewDefault &&
    config.portals.find(
      p => p.name === specifiedNewDefault || p.portalId === specifiedNewDefault
    )
  ) {
    newDefault = specifiedNewDefault;
  } else {
    logger.info(
      `The account ${specifiedNewDefault} was not found in ${configPath}.`
    );
    newDefault = await selectAccountFromConfig(config);
  }

  updateDefaultAccount(newDefault);

  return logger.log(`Default account updated to: ${newDefault}`);
};

exports.builder = yargs => {
  yargs.positional('newDefault', {
    describe: 'Account name or id to use as the default',
    type: 'string',
  });

  yargs.example([
    ['$0 config set default-account', 'Select account to use as the default'],
    [
      '$0 config set default-account MyAccount',
      'Set the default account to the account in the config with name equal to "MyAccount"',
    ],
    [
      '$0 config set default-account 1234567',
      'Set the default account to the account in the config with accountId equal to "1234567"',
    ],
  ]);

  return yargs;
};
