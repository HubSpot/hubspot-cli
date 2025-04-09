// @ts-nocheck
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
const { logError, ApiErrorContext } = require('../../lib/errorHandlers/index');
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


exports.command = 'clone-app';
exports.describe = uiBetaTag(i18n(`commands.project.subcommands.cloneApp.describe`), false);

exports.handler = async options => {
  const { derivedAccountId } = options;
  const accountConfig = getAccountConfig(derivedAccountId);
  const accountName = uiAccountDescription(derivedAccountId);

  trackCommandUsage('clone-app', {}, derivedAccountId);

  if (!isAppDeveloperAccount(accountConfig)) {
    uiLine();
    logger.error(i18n(`commands.project.subcommands.cloneApp.errors.invalidAccountTypeTitle`));
    logger.log(
      i18n(`commands.project.subcommands.cloneApp.errors.invalidAccountTypeDescription`, {
        useCommand: uiCommandReference('hs accounts use'),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    uiLine();
    process.exit(EXIT_CODES.SUCCESS);
  }

  let appId;
  let projectName;
  let projectDest;
  try {
    appId = options.appId;
    if (!appId) {
      const appIdResponse = await selectPublicAppPrompt({
        accountId: derivedAccountId,
        accountName,
        options,
        isMigratingApp: false,
      });
      appId = appIdResponse.appId;
    }
    const createProjectPromptResponse = await createProjectPrompt(options);

    projectName = createProjectPromptResponse.name;
    projectDest = createProjectPromptResponse.dest;
  } catch (error) {
    logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    process.exit(EXIT_CODES.ERROR);
  }

  await trackCommandMetadataUsage(
    'clone-app',
    { status: 'STARTED' },
    derivedAccountId
  );

  try {
    SpinniesManager.init();

    SpinniesManager.add('cloneApp', {
      text: i18n(`commands.project.subcommands.cloneApp.cloneStatus.inProgress`),
    });

    const {
      data: { exportId },
    } = await cloneApp(derivedAccountId, appId);
    const { status } = await poll(() =>
      checkCloneStatus(derivedAccountId, exportId)
    );
    if (status === 'SUCCESS') {
      // Ensure correct project folder structure exists
      const baseDestPath = path.resolve(getCwd(), projectDest);
      const absoluteDestPath = path.resolve(baseDestPath, 'src', 'app');
      fs.mkdirSync(absoluteDestPath, { recursive: true });

      // Extract zipped app files and place them in correct directory
      const { data: zippedApp } = await downloadClonedProject(
        derivedAccountId,
        exportId
      );
      await extractZipArchive(
        zippedApp,
        sanitizeFileName(projectName),
        absoluteDestPath,
        {
          includesRootDir: true,
          hideLogs: true,
        }
      );

      // Create hsproject.json file
      const configPath = path.join(baseDestPath, PROJECT_CONFIG_FILE);
      const configContent = {
        name: projectName,
        srcDir: 'src',
        platformVersion: '2023.2',
      };
      const success = writeProjectConfig(configPath, configContent);

      SpinniesManager.succeed('cloneApp', {
        text: i18n(`commands.project.subcommands.cloneApp.cloneStatus.done`),
        succeedColor: 'white',
      });
      if (!success) {
        logger.error(
          i18n(`commands.project.subcommands.cloneApp.errors.couldNotWriteConfigPath`),
          configPath
        );
      }
      logger.log('');
      uiLine();
      logger.success(i18n(`commands.project.subcommands.cloneApp.cloneStatus.success`, { dest }));
      logger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    await trackCommandMetadataUsage(
      'clone-app',
      { status: 'FAILURE' },
      derivedAccountId
    );

    SpinniesManager.fail('cloneApp', {
      text: i18n(`commands.project.subcommands.cloneApp.cloneStatus.failure`),
      failColor: 'white',
    });
    // Migrations endpoints return a response object with an errors property. The errors property contains an array of errors.
    if (error.errors && Array.isArray(error.errors)) {
      error.errors.forEach(e =>
        logError(e, new ApiErrorContext({ accountId: derivedAccountId }))
      );
    } else {
      logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    }
  }

  await trackCommandMetadataUsage(
    'clone-app',
    { status: 'SUCCESS' },
    derivedAccountId
  );
  process.exit(EXIT_CODES.SUCCESS);
};

exports.builder = yargs => {
  yargs.options({
    dest: {
      describe: i18n(`commands.project.subcommands.cloneApp.options.dest.describe`),
      type: 'string',
    },
    'app-id': {
      describe: i18n(`commands.project.subcommands.cloneApp.options.appId.describe`),
      type: 'number',
    },
  });

  yargs.example([
    ['$0 project clone-app', i18n(`commands.project.subcommands.cloneApp.examples.default`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
