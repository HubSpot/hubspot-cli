const { logger } = require('@hubspot/cli-lib/logger');
const {
  accessTokenForPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { getConfig } = require('@hubspot/cli-lib');

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
const { promptUser } = require('../../lib/prompts/promptUtils');
const { getTableContents } = require('@hubspot/cli-lib/lib/table');
const SpinniesManager = require('../../lib/SpinniesManager');
const { deleteAccount } = require('@hubspot/cli-lib/lib/config');

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

  if (filteredTestPortals && filteredTestPortals.length === 0) {
    logger.log(i18n(`${i18nKey}.noResults`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const portalsToRemove = [];
  SpinniesManager.init({
    succeedColor: 'white',
  });
  SpinniesManager.add('accountsClean', {
    text: i18n(`${i18nKey}.loading.add`),
  });

  for (const account of filteredTestPortals) {
    try {
      await accessTokenForPersonalAccessKey(account.portalId);
    } catch (error) {
      if (error && error instanceof HubSpotAuthError) {
        if (
          error.statusCode === 404 &&
          error.subCategory === 'LocalDevAuthErrorType.INVALID_PORTAL_ID'
        ) {
          portalsToRemove.push(account);
        }
      }
    }
  }
  SpinniesManager.succeed('accountsClean', {
    text: i18n(`${i18nKey}.loading.succeed`),
  });

  logger.log('');
  if (portalsToRemove.length > 0) {
    logger.log(
      i18n(`${i18nKey}.portalsMarkedForRemoval`, {
        count: portalsToRemove.length,
      })
    );
    logger.log(
      getTableContents(
        portalsToRemove.map(p => [getAccountName(p)]),
        { border: { bodyLeft: '  ' } }
      )
    );
    const { accountsCleanPrompt } = await promptUser([
      {
        name: 'accountsCleanPrompt',
        type: 'confirm',
        message: i18n(`${i18nKey}.confirm`),
      },
    ]);
    if (accountsCleanPrompt) {
      logger.log('');
      for (const accountToRemove of portalsToRemove) {
        await deleteAccount(accountToRemove);
        logger.log(
          i18n(`${i18nKey}.removeSuccess`, {
            accountName: getAccountName(accountToRemove),
          })
        );
      }
    }
  } else {
    logger.log(i18n(`${i18nKey}.noResults`));
  }

  logger.log('');
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
