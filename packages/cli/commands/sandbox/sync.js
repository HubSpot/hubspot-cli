const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const Spinnies = require('spinnies');
const { initiateSync } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getConfig, getEnv } = require('@hubspot/cli-lib');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { uiLine } = require('../../lib/ui');
const {
  getAccountName,
  getSyncTypes,
  pollSyncStatus,
} = require('../../lib/sandboxes');

const i18nKey = 'cli.commands.sandbox.subcommands.sync';

exports.command = 'sync';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  // TODO: add scripting options
  const config = getConfig();
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });

  trackCommandUsage('sandbox-sync', null, accountId);

  if (
    accountConfig.sandboxAccountType === undefined ||
    accountConfig.sandboxAccountType === null
  ) {
    trackCommandUsage('sandbox-sync', { successful: false }, accountId);

    logger.error(i18n(`${i18nKey}.failure.notSandbox`));

    process.exit(EXIT_CODES.ERROR);
  }

  let parentAccountId;
  for (const portal of config.portals) {
    if (portal.portalId === accountId) {
      if (portal.parentAccountId) {
        parentAccountId = portal.parentAccountId;
      }
    }
  }

  if (!getAccountId({ account: parentAccountId })) {
    logger.log('');
    logger.error(
      i18n(`${i18nKey}.failure.missingParentPortal`, {
        sandboxName: getAccountName(accountConfig),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const parentAccountConfig = getAccountConfig(parentAccountId);

  if (accountConfig.sandboxAccountType === 'DEVELOPER') {
    logger.log(i18n(`${i18nKey}.info.developmentSandbox`));
    logger.log(
      i18n(`${i18nKey}.info.sync`, {
        parentAccountName: getAccountName(parentAccountConfig),
        sandboxName: getAccountName(accountConfig),
      })
    );
    uiLine();
    logger.warn(i18n(`${i18nKey}.warning`));
    uiLine();
    logger.log('');

    const { confirmSandboxSyncPrompt: confirmed } = await promptUser([
      {
        name: 'confirmSandboxSyncPrompt',
        type: 'confirm',
        message: i18n(`${i18nKey}.confirm.developmentSandbox`, {
          parentAccountName: getAccountName(parentAccountConfig),
          sandboxName: getAccountName(accountConfig),
        }),
      },
    ]);
    if (!confirmed) {
      process.exit(EXIT_CODES.SUCCESS);
    }
  } else if (accountConfig.sandboxAccountType === 'STANDARD') {
    const standardSyncUrl = `${getHubSpotWebsiteOrigin(
      getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
    )}/sandboxes-developer/${parentAccountId}/sync?step=select_sync_path&id=${parentAccountId}_${accountId}`;

    logger.log(
      i18n(`${i18nKey}.info.standardSandbox`, {
        url: standardSyncUrl,
      })
    );
    logger.log(
      i18n(`${i18nKey}.info.sync`, {
        parentAccountName: getAccountName(parentAccountConfig),
        sandboxName: getAccountName(accountConfig),
      })
    );
    uiLine();
    logger.warn(i18n(`${i18nKey}.warning`));
    uiLine();
    logger.log('');

    const { confirmSandboxSyncPrompt: confirmed } = await promptUser([
      {
        name: 'confirmSandboxSyncPrompt',
        type: 'confirm',
        message: i18n(`${i18nKey}.confirm.standardSandbox`, {
          parentAccountName: getAccountName(parentAccountConfig),
          sandboxName: getAccountName(accountConfig),
        }),
      },
    ]);
    if (!confirmed) {
      process.exit(EXIT_CODES.SUCCESS);
    }
  } else {
    logger.error('Sync must be run in a sandbox account.');
    process.exit(EXIT_CODES.ERROR);
  }

  let initiateSyncResponse;

  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  try {
    // TODO: use cli progress here instead of spinnies
    logger.log('');
    spinnies.add('sandboxSync', {
      text: i18n(`${i18nKey}.loading.startSync`),
    });

    const tasks = await getSyncTypes(parentAccountConfig, accountConfig);

    if (!tasks) {
      throw new Error('Failed to fetch sync types.');
    }

    initiateSyncResponse = await initiateSync(
      parentAccountId,
      accountId,
      tasks,
      accountId
    );

    uiLine();
    logger.log(
      i18n(`${i18nKey}.info.syncStatus`, {
        url: `${baseUrl}/sandboxes-developer/${parentAccountId}/development`,
      })
    );
    uiLine();

    logger.log('');
    spinnies.succeed('sandboxSync', {
      text: i18n(`${i18nKey}.loading.succeed`),
    });
  } catch (err) {
    logErrorInstance(err);

    trackCommandUsage('sandbox-sync', { successful: false }, accountId);

    spinnies.fail('sandboxSync', {
      text: i18n(`${i18nKey}.loading.fail`),
    });

    process.exit(EXIT_CODES.ERROR);
  }

  try {
    logger.log('');
    logger.log('Sync progress:');
    await pollSyncStatus(parentAccountId, initiateSyncResponse.id);

    logger.log('');
    spinnies.add('syncComplete', {
      text: i18n(`${i18nKey}.polling.syncing`),
    });
    spinnies.succeed('syncComplete', {
      text: i18n(`${i18nKey}.polling.succeed`),
    });
  } catch (err) {
    logErrorInstance(err);

    // If polling fails at this point, we do not track a failed sync since it is running in the background.
    spinnies.add('syncComplete', {
      text: i18n(`${i18nKey}.polling.syncing`),
    });
    spinnies.fail('syncComplete', {
      text: i18n(`${i18nKey}.polling.fail`, {
        url: `${baseUrl}/sandboxes-developer/${parentAccountId}/development`,
      }),
    });

    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.example([['$0 sandbox sync', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
