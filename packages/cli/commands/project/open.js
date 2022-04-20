const open = require('open');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { logger } = require('@hubspot/cli-lib/logger');

const i18nKey = 'cli.commands.project.subcommands.open';

exports.command = 'open';
exports.describe = i18n(`${i18nKey}.describe`);

const openProjectPage = ({ env, accountId } = {}) => {
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  const url = `${websiteOrigin}/developer-projects/${accountId}`;
  open(url, { url: true });
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);

  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  openProjectPage({ env, accountId });
  logger.success(i18n(`${i18nKey}.success`, { accountId }));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.options({
    account: {
      describe: i18n(`${i18nKey}.options.account.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project open', i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
};
