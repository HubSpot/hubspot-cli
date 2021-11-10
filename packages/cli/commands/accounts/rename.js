const { logger } = require('@hubspot/cli-lib/logger');
const { renameAccount } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');

const {
  addConfigOptions,
  addAccountOptions,
  getAccountId,
  setLogLevel,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.rename';

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

exports.command = 'rename <accountName> <newName>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  console.log('options: ', options);
  loadAndValidateOptions(options);

  const { accountName, newName } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('accounts-rename', {}, accountId);

  await renameAccount(accountName, newName);

  return logger.log(
    i18n(`${i18nKey}.success.renamed`, {
      name: accountName,
      newName,
    })
  );
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.positional('accountName', {
    describe: i18n(`${i18nKey}.positionals.accountName.describe`),
    type: 'string',
  });
  yargs.positional('newName', {
    describe: i18n(`${i18nKey}.positionals.newName.describe`),
    type: 'string',
  });

  yargs.example([['$0 accounts rename myExistingPortalName myNewPortalName']]);

  return yargs;
};
