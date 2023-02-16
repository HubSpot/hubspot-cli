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
  debugErrorAndContext,
} = require('@hubspot/cli-lib/errorHandlers/standardErrors');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { deleteSandbox } = require('@hubspot/cli-lib/sandboxes');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getConfig, getEnv } = require('@hubspot/cli-lib');
const { deleteSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const {
  removeSandboxAccountFromConfig,
} = require('@hubspot/cli-lib/lib/config');
const {
  selectAndSetAsDefaultAccountPrompt,
} = require('../../lib/prompts/accountsPrompt');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');

const i18nKey = 'cli.commands.sandbox.subcommands.delete';

const SANDBOX_NOT_FOUND = 'SandboxErrors.SANDBOX_NOT_FOUND';
const OBJECT_NOT_FOUND = 'OBJECT_NOT_FOUND';

exports.command = 'delete [--account]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options, false);

  const { account } = options;
  const config = getConfig();

  let accountPrompt;
  if (!account) {
    accountPrompt = await deleteSandboxPrompt(config);
  }
  const sandboxAccountId = getAccountId({
    account: account || accountPrompt.account,
  });

  const isDefaultAccount =
    sandboxAccountId === getAccountId(config.defaultPortal);

  trackCommandUsage('sandbox-delete', null, sandboxAccountId);

  let parentAccountId;
  for (const portal of config.portals) {
    if (portal.portalId === sandboxAccountId) {
      if (portal.parentAccountId) {
        parentAccountId = portal.parentAccountId;
      } else {
        const parentAccountPrompt = await deleteSandboxPrompt(config, true);
        parentAccountId = getAccountId({
          account: parentAccountPrompt.account,
        });
      }
    }
  }

  if (!getAccountId({ account: parentAccountId })) {
    const baseUrl = getHubSpotWebsiteOrigin(
      getEnv(sandboxAccountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
    );
    const url = `${baseUrl}/sandboxes/${parentAccountId}`;
    const command = `hs auth ${
      getEnv(sandboxAccountId) === 'qa' ? '--qa' : ''
    } --account=${parentAccountId}`;
    logger.log('');
    logger.error(
      i18n(`${i18nKey}.noParentPortalAvailable`, {
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
      account: account || accountPrompt.account,
    })
  );

  if (isDefaultAccount) {
    logger.log(
      i18n(`${i18nKey}.defaultAccountWarning`, {
        account: account || accountPrompt.account,
      })
    );
  }

  try {
    const { confirmSandboxDeletePrompt: confirmed } = await promptUser([
      {
        name: 'confirmSandboxDeletePrompt',
        type: 'confirm',
        message: i18n(`${i18nKey}.confirm`, {
          account: account || accountPrompt.account,
        }),
      },
    ]);
    if (!confirmed) {
      process.exit(EXIT_CODES.SUCCESS);
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
    if (promptDefaultAccount) {
      await selectAndSetAsDefaultAccountPrompt(getConfig());
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    debugErrorAndContext(err);

    trackCommandUsage(
      'sandbox-delete',
      { successful: false },
      sandboxAccountId
    );

    if (
      err.error &&
      err.error.category === OBJECT_NOT_FOUND &&
      err.error.subCategory === SANDBOX_NOT_FOUND
    ) {
      logger.log('');
      logger.warn(
        i18n(`${i18nKey}.objectNotFound`, {
          account: account || accountPrompt.account,
        })
      );
      logger.log('');

      const promptDefaultAccount = removeSandboxAccountFromConfig(
        sandboxAccountId
      );
      if (promptDefaultAccount) {
        await selectAndSetAsDefaultAccountPrompt(getConfig());
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
