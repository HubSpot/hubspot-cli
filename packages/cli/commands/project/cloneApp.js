const fs = require('fs');
const path = require('path');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const {
  fetchPublicAppOptions,
  selectPublicAppPrompt,
} = require('../../lib/prompts/selectPublicAppPrompt');
const { promptUser } = require('../../lib/prompts/promptUtils');
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
  downloadClonedProject,
} = require('@hubspot/local-dev-lib/api/projects');
const { getCwd, isValidPath } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { extractZipArchive } = require('@hubspot/local-dev-lib/archive');

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
    uiLine();
    logger.error(i18n(`${i18nKey}.errors.invalidAccountTypeTitle`));
    logger.log(
      i18n(`${i18nKey}.errors.invalidAccountTypeDescription`, {
        useCommand: uiCommandReference('hs accounts use'),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    uiLine();
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
  const selectedApp = publicApps.find(a => a.id === appId);
  if (!selectedApp) {
    logger.error(i18n(`${i18nKey}.errors.invalidAppId`, { appId }));
    process.exit(EXIT_CODES.ERROR);
  }

  const { location } =
    'location' in options
      ? options
      : await promptUser({
          name: 'location',
          message: i18n(`${i18nKey}.enterLocation`),
          default: path.resolve(getCwd(), selectedApp.name),
          validate: input => {
            if (!input) {
              return i18n(`${i18nKey}.errors.locationRequired`);
            }
            if (fs.existsSync(input)) {
              return i18n(`${i18nKey}.errors.invalidLocation`);
            }
            if (!isValidPath(input)) {
              return i18n(`${i18nKey}.errors.invalidCharacters`);
            }
            return true;
          },
        });

  try {
    SpinniesManager.init();

    SpinniesManager.add('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.inProgress`),
    });

    const cloneResponse = await cloneApp(accountId, appId);
    const { exportId } = cloneResponse;
    const pollResponse = await poll(checkCloneStatus, accountId, exportId);
    const { status } = pollResponse;
    if (status === 'SUCCESS') {
      const absoluteDestPath = path.resolve(getCwd(), location);
      const zippedProject = await downloadClonedProject(accountId, exportId);

      await extractZipArchive(
        zippedProject,
        selectedApp.name,
        path.resolve(absoluteDestPath),
        { includesRootDir: true, hideLogs: true }
      );

      SpinniesManager.succeed('cloneApp', {
        text: i18n(`${i18nKey}.cloneStatus.done`),
        succeedColor: 'white',
      });
      logger.log('');
      uiLine();
      logger.success(i18n(`${i18nKey}.cloneStatus.success`, { location }));
      logger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    SpinniesManager.fail('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.failure`),
      failColor: 'white',
    });
    if (error.errors) {
      error.errors.forEach(logApiErrorInstance);
    } else {
      logApiErrorInstance(error, new ApiErrorContext({ accountId }));
    }
  }
};

exports.builder = yargs => {
  yargs.options({
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
