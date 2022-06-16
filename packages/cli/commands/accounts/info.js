const { logger } = require('@hubspot/cli-lib/logger');
const { getConfig, getAccountConfig } = require('@hubspot/cli-lib/lib/config');
const { getAccessToken } = require('@hubspot/cli-lib/personalAccessKey.js');
const {
  getAccountId,
  addAccountOptions,
  addConfigOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.accounts.subcommands.info';
exports.describe = i18n(`${i18nKey}.describe`);

exports.command = 'info [--account]';

exports.handler = async options => {
  await loadAndValidateOptions(options);

  let accountId = getAccountId(options);

  // check if the provided account is using a personal access key, if not, show an error
  const config = getConfig();
  const portal = config.portals.find(portal => portal.portalId === accountId);

  if (portal.authType === 'personalaccesskey') {
    const { name, personalAccessKey, env } = getAccountConfig(accountId);

    const response = await getAccessToken(personalAccessKey, env, accountId);

    let scopeGroups = response.scopeGroups.join('\n');

    logger.log(i18n(`${i18nKey}.name`, { name }));
    logger.log(i18n(`${i18nKey}.accountId`, { accountId }));
    logger.log(i18n(`${i18nKey}.scopeGroups`, { scopeGroups }));
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
