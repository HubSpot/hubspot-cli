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
  fetchPublicAppOptions,
  selectPublicAppPrompt,
} = require('../../lib/prompts/selectPublicAppPrompt');
const { poll } = require('../../lib/polling');
const {
  uiLine,
  uiCommandReference,
  uiAccountDescription,
} = require('../../lib/ui');
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { isAppDeveloperAccount } = require('../../lib/accountTypes');
const {
  cloneApp,
  checkCloneStatus,
} = require('@hubspot/local-dev-lib/api/projects');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'commands.project.subcommands.cloneApp';

exports.command = 'clone-app';
exports.describe = null; // uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const accountName = uiAccountDescription(accountId);

  trackCommandUsage('clone-app', {}, accountId);

  if (!isAppDeveloperAccount(accountConfig)) {
    logger.error(
      i18n(`${i18nKey}.errors.invalidAccountType`, {
        accountName,
        accountType: accountConfig.accountType,
        useCommand: uiCommandReference('hs accounts use'),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { appId } =
    'appId' in options
      ? options
      : await selectPublicAppPrompt({
          accountId,
          accountName,
          options,
          migrateApp: false,
        });

  const publicApps = await fetchPublicAppOptions(accountId, accountName);
  if (!publicApps.find(a => a.id === appId)) {
    logger.error(i18n(`${i18nKey}.errors.invalidAppId`, { appId }));
    process.exit(EXIT_CODES.ERROR);
  }

  const { name, location } = await createProjectPrompt('', options, true);

  const projectName = options.name || name;
  const projectLocation = options.location || location;

  try {
    SpinniesManager.init();

    SpinniesManager.add('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.inProgress`),
    });

    const cloneResponse = await cloneApp(
      accountId,
      appId,
      projectName,
      projectLocation
    );
    const { id } = cloneResponse;
    const pollResponse = await poll(checkCloneStatus, accountId, id);
    const { status } = pollResponse;
    if (status === 'SUCCESS') {
      SpinniesManager.succeed('cloneApp', {
        text: i18n(`${i18nKey}.cloneStatus.done`),
        succeedColor: 'white',
      });
      logger.log('');
      uiLine();
      logger.success(
        i18n(`${i18nKey}.cloneStatus.success`, { projectLocation })
      );
      logger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (e) {
    SpinniesManager.fail('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.failure`),
      failColor: 'white',
    });
    logApiErrorInstance(e.error, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
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
    ['$0 project clone-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
