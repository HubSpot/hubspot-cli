const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { i18n } = require('../../lib/lang');
const {
  fetchPublicApp,
  getMigrationStatus,
  migratePublicApp,
  validateAppId,
} = require('../../lib/publicApps');
const { poll } = require('../../lib/polling');
const { uiBetaTag, uiLine, uiCommandReference } = require('../../lib/ui');
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'cli.commands.project.subcommands.migrateApp';

exports.command = 'migrate-app';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);

  let appId;
  if (options.appId) {
    appId = options.appId;
    await validateAppId(appId, accountId, accountConfig.name);
  } else {
    appId = await fetchPublicApp(accountId, accountConfig.name, options, true);
    await validateAppId(appId, accountId, accountConfig.name);
  }

  const { name, location } = await createProjectPrompt('', options, appId);

  trackCommandUsage('migrate-app', {}, accountId);
  if (appId && name && location) {
    logger.log('');
    uiLine();
    logger.log(uiBetaTag(i18n(`${i18nKey}.warning.title`), false));
    logger.log(i18n(`${i18nKey}.warning.projectConversion`));
    logger.log(i18n(`${i18nKey}.warning.appConfig`));
    logger.log('');
    logger.log(i18n(`${i18nKey}.warning.buildAndDeploy`));
    logger.log('');
    logger.log(i18n(`${i18nKey}.warning.existingApps`));
    logger.log('');
    logger.log(
      i18n(`${i18nKey}.warning.cloneApp`, {
        command: uiCommandReference('hs project clone-app'),
      })
    );
    uiLine();

    const { shouldCreateApp } = await promptUser({
      name: 'shouldCreateApp',
      type: 'confirm',
      message: i18n(`${i18nKey}.createAppPrompt`),
    });

    if (!shouldCreateApp) {
      process.exit(EXIT_CODES.SUCCESS);
    }

    try {
      SpinniesManager.init();

      SpinniesManager.add('migrateApp', {
        text: i18n(`${i18nKey}.migrationStatus.inProgress`),
      });

      const { id } = await migratePublicApp(accountId, appId, name, location);
      await poll(getMigrationStatus, accountId, id);
      SpinniesManager.remove('migrateApp');
      logger.success(i18n(`${i18nKey}.migrationStatus.success`));
      process.exit(EXIT_CODES.SUCCESS);
    } catch (e) {
      SpinniesManager.remove('migrateApp');
      logApiErrorInstance(e, new ApiErrorContext({ accountId }));
      process.exit(EXIT_CODES.ERROR);
    }
  }
};

exports.builder = yargs => {
  yargs.options({
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    location: {
      describe: i18n(`${i18nKey}.options.location.describe`),
      type: 'string',
    },
    appId: {
      describe: i18n(`${i18nKey}.options.appId.describe`),
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project migrate-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
