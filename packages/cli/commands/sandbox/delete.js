const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  getAccountId,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { logger } = require('@hubspot/cli-lib/logger');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  logErrorInstance,
  debugErrorAndContext,
} = require('../../lib/errorHandlers/standardErrors');
const {
  isSpecifiedError,
  isSpecifiedHubSpotAuthError,
} = require('../../lib/errorHandlers/apiErrors');
const { deleteSandbox } = require('@hubspot/local-dev-lib/sandboxes');
const { i18n } = require('../../lib/lang');
const { deleteSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  getConfig,
  getEnv,
  getAccountConfig,
  removeSandboxAccountFromConfig,
  updateDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const {
  selectAndSetAsDefaultAccountPrompt,
} = require('../../lib/prompts/accountsPrompt');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');

const { getAccountName } = require('../../lib/sandboxes');
const { getValidEnv } = require('@hubspot/local-dev-lib/environment');

const i18nKey = 'cli.commands.sandbox.subcommands.delete';

exports.command = 'delete [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  const { account, force } = options;
  const config = getConfig();

  trackCommandUsage('sandbox-delete', null);

  let accountPrompt;
  if (!account) {
    if (!force) {
      accountPrompt = await deleteSandboxPrompt(config);
    } else {
      // Account is required, throw error if force flag is present and no account is specified
      logger.log('');
      logger.error(i18n(`${i18nKey}.failure.noAccount`));
      process.exit(EXIT_CODES.ERROR);
    }
    if (!accountPrompt) {
      logger.log('');
      logger.error(i18n(`${i18nKey}.failure.noSandboxAccounts`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const sandboxAccountId = getAccountId({
    account: account || accountPrompt.account,
  });
  const accountConfig = getAccountConfig(sandboxAccountId);
  const isDefaultAccount =
    sandboxAccountId === getAccountId(config.defaultPortal);

  const baseUrl = getHubSpotWebsiteOrigin(
    getValidEnv(getEnv(sandboxAccountId))
  );

  let parentAccountId;
  for (const portal of config.portals) {
    if (portal.portalId === sandboxAccountId) {
      if (portal.parentAccountId) {
        parentAccountId = portal.parentAccountId;
      } else if (!force) {
        const parentAccountPrompt = await deleteSandboxPrompt(config, true);
        parentAccountId = getAccountId({
          account: parentAccountPrompt.account,
        });
      } else {
        logger.error(i18n(`${i18nKey}.failure.noParentAccount`));
        process.exit(EXIT_CODES.ERROR);
      }
    }
  }

  const parentAccount = getAccountConfig(parentAccountId);
  const url = `${baseUrl}/sandboxes/${parentAccountId}`;
  const command = `hs auth ${
    getEnv(sandboxAccountId) === 'qa' ? '--qa' : ''
  } --account=${parentAccountId}`;

  if (parentAccountId && !getAccountId({ account: parentAccountId })) {
    logger.log('');
    logger.error(
      i18n(`${i18nKey}.failure.noParentPortalAvailable`, {
        parentAccountId,
        url,
        command,
      })
    );
    logger.log('');
    process.exit(EXIT_CODES.ERROR);
  }

  logger.debug(
    i18n(`${i18nKey}.debug.deleting`, {
      account: getAccountName(accountConfig),
    })
  );

  if (isDefaultAccount) {
    logger.info(
      i18n(`${i18nKey}.defaultAccountWarning`, {
        account: getAccountName(accountConfig),
      })
    );
    logger.log('');
  }

  try {
    if (!force) {
      const { confirmSandboxDeletePrompt: confirmed } = await promptUser([
        {
          name: 'confirmSandboxDeletePrompt',
          type: 'confirm',
          message: i18n(`${i18nKey}.confirm`, {
            account: getAccountName(accountConfig),
          }),
        },
      ]);
      if (!confirmed) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteSandbox(parentAccountId, sandboxAccountId);

    const deleteKey = isDefaultAccount
      ? `${i18nKey}.success.deleteDefault`
      : `${i18nKey}.success.delete`;
    logger.log('');
    logger.success(
      i18n(deleteKey, {
        account: account || accountPrompt.account,
        sandboxHubId: sandboxAccountId,
      })
    );
    logger.log('');

    const promptDefaultAccount = removeSandboxAccountFromConfig(
      sandboxAccountId
    );
    if (promptDefaultAccount && !force) {
      await selectAndSetAsDefaultAccountPrompt(getConfig());
    } else {
      // If force is specified, skip prompt and set the parent account id as the default account
      updateDefaultAccount(parentAccountId);
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    debugErrorAndContext(err);

    if (isSpecifiedHubSpotAuthError(err, { statusCode: 401 })) {
      // Intercept invalid key error
      // This command uses the parent portal PAK to delete a sandbox, so we must specify which account needs a new key
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.invalidKey`, {
          account: getAccountName(parentAccount),
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
      })
    ) {
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.invalidUser`, {
          accountName: getAccountName(accountConfig),
          parentAccountName: getAccountName(parentAccount),
        })
      );
      logger.log('');
    } else if (
      isSpecifiedError(err, {
        statusCode: 404,
        category: 'OBJECT_NOT_FOUND',
        subCategory: 'SandboxErrors.SANDBOX_NOT_FOUND',
      })
    ) {
      logger.log('');
      logger.warn(
        i18n(`${i18nKey}.failure.objectNotFound`, {
          account: getAccountName(accountConfig),
        })
      );
      logger.log('');

      const promptDefaultAccount = removeSandboxAccountFromConfig(
        sandboxAccountId
      );
      if (promptDefaultAccount && !force) {
        await selectAndSetAsDefaultAccountPrompt(getConfig());
      } else {
        // If force is specified, skip prompt and set the parent account id as the default account
        updateDefaultAccount(parentAccountId);
      }
      process.exit(EXIT_CODES.SUCCESS);
    } else {
      logErrorInstance(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.option('f', {
    type: 'boolean',
    alias: 'force',
    describe: i18n(`${i18nKey}.examples.force`),
  });

  yargs.example([
    [
      '$0 sandbox delete --account=MySandboxAccount',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
