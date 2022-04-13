const { logger } = require('@hubspot/cli-lib/logger');
const {
  getConfig,
  getConfigPath,
  updateDefaultAccount,
} = require('@hubspot/cli-lib/lib/config');
const { loadAndValidateOptions } = require('../../lib/validation');

const { getAccountId } = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.setDefault';

const selectAccountFromConfig = async config => {
  const { default: selectedDefault } = await promptUser([
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

exports.command = 'set-default [--default]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const config = getConfig();
  const configPath = getConfigPath();

  const { default: defaultAccount } = options;
  let newDefaultAccount;

  trackCommandUsage('accounts-set-default', {}, accountId);

  if (!defaultAccount) {
    newDefaultAccount = await selectAccountFromConfig(config);
  } else if (
    defaultAccount &&
    config.portals.find(
      p => p.name === defaultAccount || p.portalId === defaultAccount
    )
  ) {
    newDefaultAccount = defaultAccount;
  } else {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        specifiedAccount: defaultAccount,
        configPath,
      })
    );
    newDefaultAccount = await selectAccountFromConfig(config);
  }

  updateDefaultAccount(newDefaultAccount);

  return logger.success(
    i18n(`${i18nKey}.success.defaultAccountUpdated`, {
      accountName: newDefaultAccount,
    })
  );
};

exports.builder = yargs => {
  yargs.options('default', {
    describe: i18n(`${i18nKey}.options.default.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 accounts set-default', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts set-default --default=MyAccount',
      i18n(`${i18nKey}.examples.nameBased`),
    ],
    [
      '$0 accounts set-default --default=1234567',
      i18n(`${i18nKey}.examples.idBased`),
    ],
  ]);

  return yargs;
};
