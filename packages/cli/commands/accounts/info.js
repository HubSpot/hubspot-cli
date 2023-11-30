const { logger } = require('@hubspot/cli-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { getAccessToken } = require('@hubspot/cli-lib/personalAccessKey.js');
const {
  getAccountId,
  addAccountOptions,
  addConfigOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const { getTableContents } = require('@hubspot/local-dev-lib/logging/table');

const i18nKey = 'cli.commands.accounts.subcommands.info';
exports.describe = i18n(`${i18nKey}.describe`);

exports.command = 'info [--account]';

exports.handler = async options => {
  await loadAndValidateOptions(options);

  let accountId = getAccountId(options);
  const config = getAccountConfig(accountId);

  // check if the provided account is using a personal access key, if not, show an error
  if (config.authType === 'personalaccesskey') {
    const { name, personalAccessKey, env } = config;

    const response = await getAccessToken(personalAccessKey, env, accountId);

    const scopeGroups = response.scopeGroups.map(s => [s]);

    logger.log(i18n(`${i18nKey}.name`, { name }));
    logger.log(i18n(`${i18nKey}.accountId`, { accountId }));
    logger.log(i18n(`${i18nKey}.scopeGroups`));
    logger.log(getTableContents(scopeGroups, { border: { bodyLeft: '  ' } }));
  } else {
    logger.log(i18n(`${i18nKey}.errors.notUsingPersonalAccessKey`));
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.example([
    ['$0 accounts info', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts info --account=MyAccount',
      i18n(`${i18nKey}.examples.nameBased`),
    ],
    ['$0 accounts info --account=1234567', i18n(`${i18nKey}.examples.idBased`)],
  ]);

  return yargs;
};
