const { logger } = require('@hubspot/cli-lib/logger');
const {
  // accessTokenForPersonalAccessKey,
  getAccessToken,
} = require('@hubspot/cli-lib/personalAccessKey');
const { getConfig, getAccountConfig } = require('@hubspot/cli-lib');

const { trackCommandUsage } = require('../../lib/usageTracking');
const { i18n } = require('../../lib/lang');
const { loadAndValidateOptions } = require('../../lib/validation');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { HubSpotAuthError } = require('@hubspot/cli-lib/lib/models/Errors');
const { getAccountName } = require('../../lib/sandboxes');

const i18nKey = 'cli.commands.accounts.subcommands.clean';

exports.command = 'clean';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { qa } = options;
  await loadAndValidateOptions(options, false);

  const config = getConfig();

  trackCommandUsage('accounts-clean', null);

  const filteredTestPortals = config.portals.filter(p =>
    qa ? p.env === 'qa' : p.env !== 'qa'
  );

  for (const account of filteredTestPortals) {
    console.log('account here: ', getAccountName(account));
    try {
      // await accessTokenForPersonalAccessKey(account.portalId);
      const { personalAccessKey, env } = getAccountConfig(account.portalId);
      await getAccessToken(personalAccessKey, env, account.portalId);
    } catch (error) {
      if (error && error instanceof HubSpotAuthError) {
        if (
          error.statusCode === 404 &&
          error.subCategory === 'LocalDevAuthErrorType.INVALID_PORTAL_ID'
        ) {
          // TODO: clean up portal here
          console.log('Invalid portal error here: ', error);
          logger.log(
            i18n(`${i18nKey}.inactivePortalFound`, {
              accountName: getAccountName(account),
            })
          );
          // remove account here
        } else {
          logger.log(`Skipping ${getAccountName(account)}`, error);
        }
      } else {
        logger.log(`Skipping ${getAccountName(account)}`);
      }
    }
  }

  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  yargs.example([['$0 accounts clean']]);

  return yargs;
};
