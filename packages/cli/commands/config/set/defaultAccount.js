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
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey =
  'cli.commands.config.subcommands.set.subcommands.defaultAccount';

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
      message: i18n(`${i18nKey}.promptMessage`),
      choices: config.portals.map(p => p.name || p.portalId),
      default: config.defaultPortal,
    },
  ]);

  return selectedDefault;
};

exports.command = 'default-account [newDefault]';
exports.describe = i18n(`${i18nKey}.describe`);

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
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: specifiedNewDefault,
        configPath,
      })
    );
    newDefault = await selectAccountFromConfig(config);
  }

  updateDefaultAccount(newDefault);

  return logger.success(
    i18n(`${i18nKey}.success.defaultAccountUpdated`, {
      accountName: newDefault,
    })
  );
};

exports.builder = yargs => {
  yargs.positional('newDefault', {
    describe: i18n(`${i18nKey}.positionals.newDefault.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 config set default-account', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 config set default-account MyAccount',
      i18n(`${i18nKey}.examples.nameBased`),
    ],
    [
      '$0 config set default-account 1234567',
      i18n(`${i18nKey}.examples.idBased`),
    ],
  ]);

  return yargs;
};
