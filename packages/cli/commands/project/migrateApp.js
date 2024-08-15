const path = require('path');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const {
  trackCommandUsage,
  trackCommandMetadataUsage,
} = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  createProjectPrompt,
} = require('../../lib/prompts/createProjectPrompt');
const { i18n } = require('../../lib/lang');
const {
  selectPublicAppPrompt,
} = require('../../lib/prompts/selectPublicAppPrompt');
const { poll } = require('../../lib/polling');
const {
  uiBetaTag,
  uiLine,
  uiLink,
  uiCommandReference,
  uiAccountDescription,
} = require('../../lib/ui');
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('../../lib/errorHandlers/apiErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { isAppDeveloperAccount } = require('../../lib/accountTypes');
const { ensureProjectExists } = require('../../lib/projects');
const { handleKeypress } = require('../../lib/process');
const {
  migrateApp,
  checkMigrationStatus,
} = require('@hubspot/local-dev-lib/api/projects');
const { getCwd } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { downloadProject } = require('@hubspot/local-dev-lib/api/projects');
const { extractZipArchive } = require('@hubspot/local-dev-lib/archive');
const { getHubSpotWebsiteOrigin } = require('@hubspot/local-dev-lib/urls');
const {
  fetchPublicAppMetadata,
} = require('@hubspot/local-dev-lib/api/appsDev');

const i18nKey = 'commands.project.subcommands.migrateApp';

exports.command = 'migrate-app';
exports.describe = null; // uiBetaTag(i18n(`${i18nKey}.describe`), false);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const accountName = uiAccountDescription(accountId);

  trackCommandUsage('migrate-app', {}, accountId);

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

  const { appId } =
    'appId' in options
      ? options
      : await selectPublicAppPrompt({
          accountId,
          accountName,
          isMigratingApp: true,
        });

  let appName;
  let preventProjectMigrations;
  let listingInfo;
  try {
    const selectedApp = await fetchPublicAppMetadata(appId, accountId);
    // preventProjectMigrations returns true if we have not added app to allowlist config.
    // listingInfo will only exist for marketplace apps
    preventProjectMigrations = selectedApp.preventProjectMigrations;
    listingInfo = selectedApp.listingInfo;
    if (preventProjectMigrations && listingInfo) {
      logger.error(i18n(`${i18nKey}.errors.invalidApp`, { appId }));
      process.exit(EXIT_CODES.ERROR);
    }
    appName = selectedApp.name;
  } catch (error) {
    logApiErrorInstance(error, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
  }

  let projectName;
  let projectLocation;
  try {
    const { name, location } = await createProjectPrompt('', options, true);

    projectName = options.name || name;
    projectLocation = options.location || location;

    const { projectExists } = await ensureProjectExists(
      accountId,
      projectName,
      {
        allowCreate: false,
        noLogs: true,
      }
    );

    if (projectExists) {
      logger.error(
        i18n(`${i18nKey}.errors.projectAlreadyExists`, {
          projectName,
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } catch (error) {
    logApiErrorInstance(error, new ApiErrorContext({ accountId }));
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log('');
  uiLine();
  logger.log(uiBetaTag(i18n(`${i18nKey}.warning.title`, { appName }), false));
  logger.log(i18n(`${i18nKey}.warning.projectConversion`));
  logger.log(i18n(`${i18nKey}.warning.appConfig`));
  logger.log('');
  logger.log(i18n(`${i18nKey}.warning.buildAndDeploy`));
  logger.log('');
  logger.log(i18n(`${i18nKey}.warning.existingApps`));
  logger.log('');
  logger.log(i18n(`${i18nKey}.warning.copyApp`));
  uiLine();

  const { shouldCreateApp } = await promptUser({
    name: 'shouldCreateApp',
    type: 'confirm',
    message: i18n(`${i18nKey}.createAppPrompt`),
  });
  process.stdin.resume();

  if (!shouldCreateApp) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    SpinniesManager.init();

    SpinniesManager.add('migrateApp', {
      text: i18n(`${i18nKey}.migrationStatus.inProgress`),
    });

    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        SpinniesManager.remove('migrateApp');
        logger.log(i18n(`${i18nKey}.migrationInterrupted`));
        process.exit(EXIT_CODES.SUCCESS);
      }
    });

    const migrateResponse = await migrateApp(accountId, appId, projectName);
    const { id } = migrateResponse;
    const pollResponse = await poll(checkMigrationStatus, accountId, id);
    const { status, project } = pollResponse;
    if (status === 'SUCCESS') {
      const absoluteDestPath = path.resolve(getCwd(), projectLocation);
      const { env } = getAccountConfig(accountId);
      const baseUrl = getHubSpotWebsiteOrigin(env);

      const zippedProject = await downloadProject(accountId, projectName, 1);

      await extractZipArchive(
        zippedProject,
        projectName,
        path.resolve(absoluteDestPath),
        { includesRootDir: true, hideLogs: true }
      );

      const isListed = Boolean(listingInfo);
      trackCommandMetadataUsage(
        'migrate-app',
        { projectName, appId, status, preventProjectMigrations, isListed },
        accountId
      );

      SpinniesManager.succeed('migrateApp', {
        text: i18n(`${i18nKey}.migrationStatus.done`),
        succeedColor: 'white',
      });
      logger.log('');
      uiLine();
      logger.success(i18n(`${i18nKey}.migrationStatus.success`));
      logger.log('');
      logger.log(
        uiLink(
          i18n(`${i18nKey}.projectDetailsLink`),
          `${baseUrl}/developer-projects/${accountId}/project/${project.name}`
        )
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  } catch (error) {
    trackCommandMetadataUsage(
      'migrate-app',
      { projectName, appId, status: 'FAILURE', error },
      accountId
    );
    SpinniesManager.fail('migrateApp', {
      text: i18n(`${i18nKey}.migrationStatus.failure`),
      failColor: 'white',
    });
    // Migrations endpoints return a response object with an errors property. The errors property contains an array of errors.
    if (error.errors && Array.isArray(error.errors)) {
      error.errors.forEach(e =>
        logApiErrorInstance(e, new ApiErrorContext({ accountId }))
      );
    } else {
      logApiErrorInstance(error, new ApiErrorContext({ accountId }));
    }

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
    ['$0 project migrate-app', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
