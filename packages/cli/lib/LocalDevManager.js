const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');
const { i18n } = require('./lang');
const { handleKeypress } = require('./process');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  fetchAppInstallationData,
} = require('@hubspot/local-dev-lib/api/localDevAuth');
const {
  fetchPublicAppsForPortal,
  fetchPublicAppDeveloperTestAccountInstallData,
} = require('@hubspot/local-dev-lib/api/appsDev');
const {
  getAccountId,
  getConfigDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const {
  PrivateAppUserTokenManager,
} = require('@hubspot/local-dev-lib/PrivateAppUserTokenManager');
const { PROJECT_CONFIG_FILE } = require('./constants');
const SpinniesManager = require('./ui/SpinniesManager');
const DevServerManager = require('./DevServerManager');
const { EXIT_CODES } = require('./enums/exitCodes');
const { getProjectDetailUrl } = require('./projects');
const { getAccountHomeUrl } = require('./localDev');
const {
  CONFIG_FILES,
  COMPONENT_TYPES,
  getAppCardConfigs,
} = require('./projectStructure');
const {
  UI_COLORS,
  uiCommandReference,
  uiAccountDescription,
  uiBetaTag,
  uiLink,
  uiLine,
} = require('./ui');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { installPublicAppPrompt } = require('./prompts/installPublicAppPrompt');
const {
  activeInstallConfirmationPrompt,
} = require('./prompts/activeInstallConfirmationPrompt');

const WATCH_EVENTS = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlinkDir',
};

const i18nKey = 'lib.LocalDevManager';

class LocalDevManager {
  constructor(options) {
    this.targetAccountId = options.targetAccountId;
    // The account that the project exists in. This is not always the targetAccountId
    this.targetProjectAccountId = options.parentAccountId || options.accountId;

    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.projectId = options.projectId;
    this.debug = options.debug || false;
    this.deployedBuild = options.deployedBuild;
    this.isGithubLinked = options.isGithubLinked;
    this.watcher = null;
    this.uploadWarnings = {};
    this.runnableComponents = this.getRunnableComponents(options.components);
    this.activeApp = null;
    this.activePublicAppData = null;
    this.env = options.env;
    this.publicAppActiveInstalls = null;
    this.privateAppUserTokenManager = null;
    this.projectSourceDir = path.join(
      this.projectDir,
      this.projectConfig.srcDir
    );

    if (!this.targetAccountId || !this.projectConfig || !this.projectDir) {
      logger.log(i18n(`${i18nKey}.failedToInitialize`));
      process.exit(EXIT_CODES.ERROR);
    }

    // The project is empty, there is nothing to run locally
    if (!options.components.length) {
      logger.error(i18n(`${i18nKey}.noComponents`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    // The project does not contain any components that support local development
    if (!this.runnableComponents.length) {
      logger.error(
        i18n(`${i18nKey}.noRunnableComponents`, {
          projectSourceDir: this.projectSourceDir,
          command: uiCommandReference('hs project add'),
        })
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  getRunnableComponents(components) {
    return components.filter(component => component.runnable);
  }

  async setActiveApp(appUid) {
    if (!appUid) {
      logger.error(
        i18n(`${i18nKey}.missingUid`, {
          devCommand: uiCommandReference('hs project dev'),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
    this.activeApp = this.runnableComponents.find(component => {
      return component.config.uid === appUid;
    });
    if (this.privateAppUserTokenManager) {
      this.privateAppUserTokenManager.cleanup();
      this.privateAppUserTokenManager = null;
    }

    if (this.activeApp.type === COMPONENT_TYPES.publicApp) {
      try {
        await this.setActivePublicAppData();
        await this.checkActivePublicAppInstalls();
        await this.checkPublicAppInstallation();
      } catch (e) {
        logErrorInstance(e);
      }
    } else if (this.activeApp.type == COMPONENT_TYPES.privateApp) {
      try {
        this.privateAppUserTokenManager = new PrivateAppUserTokenManager(
          this.targetAccountId
        );
        await this.privateAppUserTokenManager.init();
      } catch (e) {
        logErrorInstance(e);
      }
    }
  }

  async setActivePublicAppData() {
    if (!this.activeApp) {
      return;
    }

    const portalPublicApps = await fetchPublicAppsForPortal(
      this.targetProjectAccountId
    );

    const activePublicAppData = portalPublicApps.find(
      ({ sourceId }) => sourceId === this.activeApp.config.uid
    );

    const {
      testPortalInstallCount,
    } = await fetchPublicAppDeveloperTestAccountInstallData(
      activePublicAppData.id,
      this.targetProjectAccountId
    );

    this.activePublicAppData = activePublicAppData;
    this.publicAppActiveInstalls =
      activePublicAppData.publicApplicationInstallCounts
        .uniquePortalInstallCount - testPortalInstallCount;
  }

  async checkActivePublicAppInstalls() {
    if (
      !this.activePublicAppData ||
      !this.publicAppActiveInstalls ||
      this.publicAppActiveInstalls < 1
    ) {
      return;
    }
    uiLine();

    logger.warn(
      i18n(`${i18nKey}.activeInstallWarning.installCount`, {
        appName: this.activePublicAppData.name,
        installCount: this.publicAppActiveInstalls,
        installText:
          this.publicAppActiveInstalls === 1 ? 'install' : 'installs',
      })
    );
    logger.log(i18n(`${i18nKey}.activeInstallWarning.explanation`));
    uiLine();
    const proceed = await activeInstallConfirmationPrompt();

    if (!proceed) {
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  async getPrivateAppUserToken(appId) {
    try {
      if (this.privateAppUserTokenManager) {
        const result = await this.privateAppUserTokenManager.getPrivateAppUserToken(
          appId
        );
        return result;
      }
    } catch (e) {
      logErrorInstance(e);
    }
  }

  async start() {
    SpinniesManager.stopAll();
    SpinniesManager.init();

    // Local dev currently relies on the existence of a deployed build in the target account
    if (!this.deployedBuild) {
      logger.error(
        i18n(`${i18nKey}.noDeployedBuild`, {
          projectName: this.projectConfig.name,
          accountIdentifier: uiAccountDescription(this.targetProjectAccountId),
          uploadCommand: this.getUploadCommand(),
        })
      );
      logger.log();
      process.exit(EXIT_CODES.SUCCESS);
    }

    const setupSucceeded = await this.devServerSetup();

    if (!setupSucceeded) {
      process.exit(EXIT_CODES.ERROR);
    } else if (!this.debug) {
      console.clear();
    }

    uiBetaTag(i18n(`${i18nKey}.betaMessage`));

    logger.log(
      uiLink(
        i18n(`${i18nKey}.learnMoreLocalDevServer`),
        'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
      )
    );

    logger.log();
    logger.log(
      chalk.hex(UI_COLORS.SORBET)(
        i18n(`${i18nKey}.running`, {
          accountIdentifier: uiAccountDescription(this.targetAccountId),
          projectName: this.projectConfig.name,
        })
      )
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.viewProjectLink`),
        getProjectDetailUrl(
          this.projectConfig.name,
          this.targetProjectAccountId
        )
      )
    );

    if (this.activeApp.type === COMPONENT_TYPES.publicApp) {
      logger.log(
        uiLink(
          i18n(`${i18nKey}.viewTestAccountLink`),
          getAccountHomeUrl(this.targetAccountId)
        )
      );
    }

    logger.log();
    logger.log(i18n(`${i18nKey}.quitHelper`));
    uiLine();
    logger.log();

    await this.devServerStart();

    // Initialize project file watcher to detect configuration file changes
    this.startWatching();

    this.updateKeypressListeners();

    this.monitorConsoleOutput();

    // Verify that there are no mismatches between components in the local project
    // and components in the deployed build of the project.
    this.compareLocalProjectToDeployed();
  }

  async stop(showProgress = true) {
    if (showProgress) {
      SpinniesManager.add('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingStart`),
      });
    }
    await this.stopWatching();

    const cleanupSucceeded = await this.devServerCleanup();
    if (this.privateAppUserTokenManager) {
      this.privateAppUserTokenManager.cleanup();
    }
    if (!cleanupSucceeded) {
      if (showProgress) {
        SpinniesManager.fail('cleanupMessage', {
          text: i18n(`${i18nKey}.exitingFail`),
        });
      }
      process.exit(EXIT_CODES.ERROR);
    }

    if (showProgress) {
      SpinniesManager.succeed('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingSucceed`),
      });
    }
    process.exit(EXIT_CODES.SUCCESS);
  }

  getActiveAppInstallationData() {
    return fetchAppInstallationData(
      this.targetAccountId,
      this.projectId,
      this.activeApp.config.uid,
      this.activeApp.config.auth.requiredScopes,
      this.activeApp.config.auth.optionalScopes
    );
  }

  async checkPublicAppInstallation() {
    const {
      isInstalledWithScopeGroups,
      previouslyAuthorizedScopeGroups,
    } = await this.getActiveAppInstallationData();

    const isReinstall = previouslyAuthorizedScopeGroups.length > 0;

    if (!isInstalledWithScopeGroups) {
      await installPublicAppPrompt(
        this.env,
        this.targetAccountId,
        this.activePublicAppData.clientId,
        this.activeApp.config.auth.requiredScopes,
        this.activeApp.config.auth.redirectUrls,
        isReinstall
      );
    }
  }

  updateKeypressListeners() {
    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        this.stop();
      }
    });
  }

  getUploadCommand() {
    const currentDefaultAccount = getConfigDefaultAccount();

    return this.targetProjectAccountId !== getAccountId(currentDefaultAccount)
      ? uiCommandReference(
          `hs project upload --account=${this.targetProjectAccountId}`
        )
      : uiCommandReference('hs project upload');
  }

  logUploadWarning(reason) {
    let warning = reason;
    if (!reason) {
      warning =
        this.activeApp.type === COMPONENT_TYPES.publicApp &&
        this.publicAppActiveInstalls > 0
          ? i18n(`${i18nKey}.uploadWarning.defaultPublicAppWarning`, {
              installCount: this.publicAppActiveInstalls,
              installText:
                this.publicAppActiveInstalls === 1 ? 'install' : 'installs',
            })
          : i18n(`${i18nKey}.uploadWarning.defaultWarning`);
    }

    // Avoid logging the warning to the console if it is currently the most
    // recently logged warning. We do not want to spam the console with the same message.
    if (!this.uploadWarnings[warning]) {
      logger.log();
      logger.warn(i18n(`${i18nKey}.uploadWarning.header`, { warning }));
      logger.log(
        i18n(`${i18nKey}.uploadWarning.stopDev`, {
          command: uiCommandReference('hs project dev'),
        })
      );
      if (this.isGithubLinked) {
        logger.log(i18n(`${i18nKey}.uploadWarning.pushToGithub`));
      } else {
        logger.log(
          i18n(`${i18nKey}.uploadWarning.runUpload`, {
            command: this.getUploadCommand(),
          })
        );
      }
      logger.log(
        i18n(`${i18nKey}.uploadWarning.restartDev`, {
          command: uiCommandReference('hs project dev'),
        })
      );

      this.mostRecentUploadWarning = warning;
      this.uploadWarnings[warning] = true;
    }
  }

  monitorConsoleOutput() {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    process.stdout.write = function(chunk, encoding, callback) {
      // Reset the most recently logged warning
      if (
        this.mostRecentUploadWarning &&
        this.uploadWarnings[this.mostRecentUploadWarning]
      ) {
        delete this.uploadWarnings[this.mostRecentUploadWarning];
      }

      return originalStdoutWrite(chunk, encoding, callback);
    }.bind(this);
  }

  compareLocalProjectToDeployed() {
    const deployedComponentNames = this.deployedBuild.subbuildStatuses.map(
      subbuildStatus => subbuildStatus.buildName
    );

    let missingComponents = [];

    this.runnableComponents.forEach(({ type, config, path }) => {
      if (Object.values(COMPONENT_TYPES).includes(type)) {
        const cardConfigs = getAppCardConfigs(config, path);

        if (!deployedComponentNames.includes(config.name)) {
          missingComponents.push(
            `${i18n(`${i18nKey}.uploadWarning.appLabel`)} ${config.name}`
          );
        }

        cardConfigs.forEach(cardConfig => {
          if (
            cardConfig.data &&
            cardConfig.data.title &&
            !deployedComponentNames.includes(cardConfig.data.title)
          ) {
            missingComponents.push(
              `${i18n(`${i18nKey}.uploadWarning.uiExtensionLabel`)} ${
                cardConfig.data.title
              }`
            );
          }
        });
      }
    });

    if (missingComponents.length) {
      this.logUploadWarning(
        i18n(`${i18nKey}.uploadWarning.missingComponents`, {
          missingComponents: missingComponents.join(', '),
        })
      );
    }
  }

  startWatching() {
    this.watcher = chokidar.watch(this.projectDir, {
      ignoreInitial: true,
    });

    const configPaths = this.runnableComponents
      .filter(({ type }) => Object.values(COMPONENT_TYPES).includes(type))
      .map(component => {
        const appConfigPath = path.join(
          component.path,
          CONFIG_FILES[component.type]
        );
        return appConfigPath;
      });

    const projectConfigPath = path.join(this.projectDir, PROJECT_CONFIG_FILE);
    configPaths.push(projectConfigPath);

    this.watcher.on('add', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.add, configPaths);
    });
    this.watcher.on('change', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.change, configPaths);
    });
    this.watcher.on('unlink', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlink, configPaths);
    });
    this.watcher.on('unlinkDir', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlinkDir, configPaths);
    });
  }

  async stopWatching() {
    await this.watcher.close();
  }

  handleWatchEvent(filePath, event, configPaths) {
    if (configPaths.includes(filePath)) {
      this.logUploadWarning();
    } else {
      this.devServerFileChange(filePath, event);
    }
  }

  async devServerSetup() {
    try {
      await DevServerManager.setup({
        components: this.runnableComponents,
        onUploadRequired: this.logUploadWarning.bind(this),
        accountId: this.targetAccountId,
        setActiveApp: this.setActiveApp.bind(this),
      });
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.setupError`, { message: e.message })
      );
      return false;
    }
  }

  async devServerStart() {
    try {
      const args = {
        accountId: this.targetAccountId,
        projectConfig: this.projectConfig,
        ...(this.privateAppUserTokenManager && {
          getPrivateAppUserToken: this.getPrivateAppUserToken.bind(this),
        }),
      };
      logger.debug('args for dev server start {{args}}', { args });
      await DevServerManager.start(args);
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.startError`, { message: e.message })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  devServerFileChange(filePath, event) {
    try {
      DevServerManager.fileChange({ filePath, event });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.fileChangeError`, {
          message: e.message,
        })
      );
    }
  }

  async devServerCleanup() {
    try {
      await DevServerManager.cleanup();
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.cleanupError`, { message: e.message })
      );
      return false;
    }
  }
}

module.exports = LocalDevManager;
