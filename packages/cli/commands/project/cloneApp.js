const path = require('path');
const fs = require('fs');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const {
  trackCommandUsage,
  trackCommandMetadataUsage,
} = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('../../lib/lang');
const {
  selectPublicAppPrompt,
} = require('../../lib/prompts/selectPublicAppPrompt');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { poll } = require('../../lib/polling');
const {
  uiBetaTag,
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
const { writeProjectConfig } = require('../../lib/projects');
const { PROJECT_CONFIG_FILE } = require('../../lib/constants');
const {
  cloneApp,
  checkCloneStatus,
  downloadClonedProject,
} = require('@hubspot/local-dev-lib/api/projects');
const { getCwd, sanitizeFileName } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { extractZipArchive } = require('@hubspot/local-dev-lib/archive');

const i18nKey = 'commands.project.subcommands.cloneApp';

exports.command = 'clone-app';
exports.describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { account } = options;
  const accountConfig = getAccountConfig(account);
  const accountName = uiAccountDescription(account);

  trackCommandUsage('clone-app', {}, account);

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
    process.exit(EXIT_CODES.SUCCESS);
  }

  let appId;
  let name;
  let location;
  try {
    appId = options.appId;
    if (!appId) {
      const appIdResponse = await selectPublicAppPrompt({
        accountId: account,
        accountName,
        options,
        isMigratingApp: false,
      });
      appId = appIdResponse.appId;
    }

    const projectResponse = await createProjectPrompt('', options, true);
    name = projectResponse.name;
    location = projectResponse.location;
  } catch (error) {
    logApiErrorInstance(error, new ApiErrorContext({ accountId: account }));
    process.exit(EXIT_CODES.ERROR);
  }
  try {
    SpinniesManager.init();

    SpinniesManager.add('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.inProgress`),
    });

    const { exportId } = await cloneApp(account, appId);
    const { status } = await poll(checkCloneStatus, account, exportId);
    if (status === 'SUCCESS') {
      // Ensure correct project folder structure exists
      const baseDestPath = path.resolve(getCwd(), location);
      const absoluteDestPath = path.resolve(baseDestPath, 'src', 'app');
      fs.mkdirSync(absoluteDestPath, { recursive: true });

      // Extract zipped app files and place them in correct directory
      const zippedApp = await downloadClonedProject(account, exportId);
      await extractZipArchive(
        zippedApp,
        sanitizeFileName(name),
        absoluteDestPath,
        {
          includesRootDir: true,
          hideLogs: true,
        }
      );

      // Create hsproject.json file
      const configPath = path.join(baseDestPath, PROJECT_CONFIG_FILE);
      const configContent = {
        name,
        srcDir: 'src',
        platformVersion: '2023.2',
      };
      const success = writeProjectConfig(configPath, configContent);

      trackCommandMetadataUsage(
        'clone-app',
        {
          type: name,
          assetType: appId,
          successful: success,
        },
        account
      );

      SpinniesManager.succeed('cloneApp', {
        text: i18n(`${i18nKey}.cloneStatus.done`),
        succeedColor: 'white',
      });
      if (!success) {
        logger.error(
          i18n(`${i18nKey}.errors.couldNotWriteConfigPath`),
          configPath
        );
      }
      logger.log('');
      uiLine();
      logger.success(i18n(`${i18nKey}.cloneStatus.success`, { location }));
      logger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    trackCommandMetadataUsage(
      'clone-app',
      { projectName: name, appId, status: 'FAILURE', error },
      account
    );

    SpinniesManager.fail('cloneApp', {
      text: i18n(`${i18nKey}.cloneStatus.failure`),
      failColor: 'white',
    });
    // Migrations endpoints return a response object with an errors property. The errors property contains an array of errors.
    if (error.errors && Array.isArray(error.errors)) {
      error.errors.forEach(e =>
        logApiErrorInstance(e, new ApiErrorContext({ accountId: account }))
      );
    } else {
      logApiErrorInstance(error, new ApiErrorContext({ accountId: account }));
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
