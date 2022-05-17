const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountConfig } = require('@hubspot/cli-lib/lib/config');
const { getAccessToken } = require('@hubspot/cli-lib/personalAccessKey.js');
const {
  getAccountId,
  addAccountOptions,
  addConfigOptions,
} = require('../lib/commonOpts');
const { loadAndValidateOptions } = require('../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.whoami';
exports.describe = i18n(`${i18nKey}.describe`);

exports.command = 'whoami';

exports.handler = async options => {
  await loadAndValidateOptions(options);

  let accountId = getAccountId(options);
  const { name, personalAccessKey, env } = getAccountConfig(accountId);

  const response = await getAccessToken(personalAccessKey, env, accountId);

  let scopeGroups = response.scopeGroups.join('\n');

  logger.log(i18n(`${i18nKey}.name`, { name }));
  logger.log(i18n(`${i18nKey}.accountId`, { accountId }));
  logger.log(i18n(`${i18nKey}.scopeGroups`, { scopeGroups }));
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.example([
    ['$0 whoami', i18n(`${i18nKey}.examples.default`)],
    ['$0 whoami --account=MyAccount', i18n(`${i18nKey}.examples.nameBased`)],
    ['$0 accounts use --account=1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs;
};
