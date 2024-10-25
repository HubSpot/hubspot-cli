// @ts-nocheck
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  getAccountId,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { logError, debugError } = require('../../lib/errorHandlers/index');
const { isSpecifiedError } = require('@hubspot/local-dev-lib/errors/index');
const { deleteSandbox } = require('@hubspot/local-dev-lib/api/sandboxHubs');
const { i18n } = require('../../lib/lang');
const { deleteSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  getConfig,
  getEnv,
  removeSandboxAccountFromConfig,
  updateDefaultAccount,
  getDefaultAccount,
  getAccounts,
} = require('@hubspot/local-dev-lib/config');
const {
  getAccountIdentifier,
} = require('@hubspot/local-dev-lib/config/getAccountIdentifier');
const {
  selectAndSetAsDefaultAccountPrompt,
} = require('../../lib/prompts/accountsPrompt');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { uiAccountDescription, uiBetaTag } = require('../../lib/ui');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');

const { getValidEnv } = require('@hubspot/local-dev-lib/environment');

const i18nKey = 'commands.sandbox.subcommands.delete';

exports.command = 'delete [--account]';
exports.describe = exports.describe = uiBetaTag(
  i18n(`${i18nKey}.describe`),
  false
);

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  // We don't want to auto inject the account flag from middleware.
  // --providedAccount preserves the original --account and --portal flags.
  const { providedAccount, force } = options;
  const config = getConfig();

  trackCommandUsage('sandbox-delete', null);

  let accountPrompt;
  if (!providedAccount) {
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
    account: providedAccount || accountPrompt.account,
  });
  const isDefaultAccount =
    sandboxAccountId === getAccountId(getDefaultAccount(config));

  const baseUrl = getHubSpotWebsiteOrigin(
    getValidEnv(getEnv(sandboxAccountId))
  );

  let parentAccountId;
  const accountsList = getAccounts();
  for (const portal of accountsList) {
    if (getAccountIdentifier(portal) === sandboxAccountId) {
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
      account: uiAccountDescription(sandboxAccountId),
    })
  );

  if (isDefaultAccount) {
    logger.info(
      i18n(`${i18nKey}.defaultAccountWarning`, {
        account: uiAccountDescription(sandboxAccountId),
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
            account: uiAccountDescription(sandboxAccountId),
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
        account: providedAccount || accountPrompt.account,
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
    debugError(err);

    if (isSpecifiedError(err, { statusCode: 401 })) {
      // Intercept invalid key error
      // This command uses the parent portal PAK to delete a sandbox, so we must specify which account needs a new key
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.invalidKey`, {
          account: uiAccountDescription(parentAccountId),
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
          accountName: uiAccountDescription(sandboxAccountId),
          parentAccountName: uiAccountDescription(parentAccountId),
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
          account: uiAccountDescription(sandboxAccountId),
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
      logError(err);
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

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  return yargs;
};
