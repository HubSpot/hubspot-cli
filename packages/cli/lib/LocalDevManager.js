const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');
const { i18n } = require('./lang');
const { handleKeypress } = require('./process');
const { logger } = require('@hubspot/local-dev-lib/logger');
const {
  getAccountId,
  getConfigDefaultAccount,
} = require('@hubspot/local-dev-lib/config');
const { PROJECT_CONFIG_FILE } = require('./constants');
const SpinniesManager = require('./ui/SpinniesManager');
const DevServerManager = require('./DevServerManager');
const { EXIT_CODES } = require('./enums/exitCodes');
const { getProjectDetailUrl } = require('./projects');
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

const WATCH_EVENTS = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlinkDir',
};

const i18nKey = 'cli.lib.LocalDevManager';

class LocalDevManager {
  constructor(options) {
    this.targetAccountId = options.targetAccountId;
    // The account that the project exists in. This is not always the targetAccountId
    this.targetProjectAccountId = options.parentAccountId || options.accountId;

    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.debug = options.debug || false;
    this.deployedBuild = options.deployedBuild;
    this.isGithubLinked = options.isGithubLinked;
    this.watcher = null;
    this.uploadWarnings = {};
    this.runnableComponents = this.getRunnableComponents(options.components);

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

  async start() {
    SpinniesManager.stopAll();
    SpinniesManager.init();

    // Local dev currently relies on the existence of a deployed build in the target account
    if (!this.deployedBuild) {
      logger.error(
        i18n(`${i18nKey}.noDeployedBuild`, {
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
        i18n(`${i18nKey}.viewInHubSpotLink`),
        getProjectDetailUrl(
          this.projectConfig.name,
          this.targetProjectAccountId
        )
      )
    );
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
    const warning = reason || i18n(`${i18nKey}.uploadWarning.defaultWarning`);

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
      await DevServerManager.start({
        accountId: this.targetAccountId,
        projectConfig: this.projectConfig,
      });
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
