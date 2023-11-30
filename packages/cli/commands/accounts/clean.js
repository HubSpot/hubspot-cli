const { logger } = require('@hubspot/cli-lib/logger');
const {
  accessTokenForPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');

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
const { getAccountName } = require('../../lib/sandboxes');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { getTableContents } = require('@hubspot/local-dev-lib/logging/table');
const SpinniesManager = require('../../lib/SpinniesManager');
const { getConfig, deleteAccount } = require('@hubspot/local-dev-lib/config');
const {
  isSpecifiedHubSpotAuthError,
} = require('../../lib/errorHandlers/apiErrors');

const i18nKey = 'cli.commands.accounts.subcommands.clean';

exports.command = 'clean';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  const { qa } = options;
  await loadAndValidateOptions(options, false);

  const config = getConfig();

  trackCommandUsage('accounts-clean', null);

  const filteredTestAccounts = config.portals.filter(p =>
    qa ? p.env === 'qa' : p.env !== 'qa'
  );

  if (filteredTestAccounts && filteredTestAccounts.length === 0) {
    logger.log(i18n(`${i18nKey}.noResults`));
    process.exit(EXIT_CODES.SUCCESS);
  }

  const accountsToRemove = [];
  SpinniesManager.init({
    succeedColor: 'white',
  });
  SpinniesManager.add('accountsClean', {
    text: i18n(`${i18nKey}.loading.add`),
  });

  for (const account of filteredTestAccounts) {
    try {
      await accessTokenForPersonalAccessKey(account.portalId);
    } catch (error) {
      if (
        isSpecifiedHubSpotAuthError(error, {
          statusCode: 401,
          category: 'INVALID_AUTHENTICATION',
          subCategory: 'LocalDevAuthErrorType.PORTAL_NOT_ACTIVE',
        }) ||
        isSpecifiedHubSpotAuthError(error, {
          statusCode: 404,
          category: 'INVALID_AUTHENTICATION',
          subCategory: 'LocalDevAuthErrorType.INVALID_PORTAL_ID',
        })
      ) {
        accountsToRemove.push(account);
      }
    }
  }

  if (accountsToRemove.length > 0) {
    const oneAccountFound = accountsToRemove.length === 1;
    SpinniesManager.succeed('accountsClean', {
      text: i18n(
        oneAccountFound
          ? `${i18nKey}.inactiveAccountsFound.one`
          : `${i18nKey}.inactiveAccountsFound.other`,
        {
          count: accountsToRemove.length,
        }
      ),
    });
    logger.log(
      getTableContents(
        accountsToRemove.map(p => [getAccountName(p)]),
        { border: { bodyLeft: '  ' } }
      )
    );
    const { accountsCleanPrompt } = await promptUser([
      {
        name: 'accountsCleanPrompt',
        type: 'confirm',
        message: i18n(
          oneAccountFound
            ? `${i18nKey}.confirm.one`
            : `${i18nKey}.confirm.other`,
          {
            count: accountsToRemove.length,
          }
        ),
      },
    ]);
    if (accountsCleanPrompt) {
      logger.log('');
      for (const accountToRemove of accountsToRemove) {
        await deleteAccount(accountToRemove.name);
        logger.log(
          i18n(`${i18nKey}.removeSuccess`, {
            accountName: getAccountName(accountToRemove),
          })
        );
      }
    }
  } else {
    SpinniesManager.succeed('accountsClean', {
      text: i18n(`${i18nKey}.noResults`),
    });
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
