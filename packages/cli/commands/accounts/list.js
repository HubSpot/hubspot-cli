const { logger } = require('@hubspot/cli-lib/logger');
const { getConfig, getConfigPath } = require('@hubspot/cli-lib/lib/config');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');

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

const i18nKey = 'cli.commands.accounts.subcommands.list';

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

exports.command = 'list';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  trackCommandUsage('accounts-list', {}, accountId);

  const config = getConfig();
  const configPath = getConfigPath();
  const portalData = config.portals.map(portal => {
    return [portal.name, portal.portalId, portal.authType];
  });
  portalData.unshift(
    getTableHeader([
      i18n(`${i18nKey}.labels.name`),
      i18n(`${i18nKey}.labels.accountId`),
      i18n(`${i18nKey}.labels.authType`),
    ])
  );

  logger.log(i18n(`${i18nKey}.configPath`, { configPath }));
  logger.log(
    i18n(`${i18nKey}.defaultAccount`, { account: config.defaultPortal })
  );
  logger.log(i18n(`${i18nKey}.accounts`));
  logger.log(getTableContents(portalData, { border: { bodyLeft: '  ' } }));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.example([['$0 accounts list']]);

  return yargs;
};
