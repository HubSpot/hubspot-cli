const path = require('path');
const chalk = require('chalk');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { handleKeypress } = require('@hubspot/cli-lib/lib/process');
const SpinniesManager = require('./SpinniesManager');
const DevServerManager = require('./DevServerManager');
const { EXIT_CODES } = require('./enums/exitCodes');
const { getProjectDetailUrl } = require('./projects');
const { findProjectComponents } = require('./projectStructure');
const {
  UI_COLORS,
  uiAccountDescription,
  uiBetaMessage,
  uiLink,
  uiLine,
} = require('./ui');

const i18nKey = 'cli.lib.LocalDevManagerV2';

class LocalDevManagerV2 {
  constructor(options) {
    this.targetAccountId = options.targetAccountId;
    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.debug = options.debug || false;
    this.alpha = options.alpha;

    this.projectSourceDir = path.join(
      this.projectDir,
      this.projectConfig.srcDir
    );

    if (!this.targetAccountId || !this.projectConfig || !this.projectDir) {
      logger.log(i18n(`${i18nKey}.failedToInitialize`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async start() {
    SpinniesManager.removeAll();
    SpinniesManager.init();

    const componentsByType = await findProjectComponents(this.projectSourceDir);

    const componentTypes = Object.keys(componentsByType);

    if (!componentTypes.length) {
      logger.log();
      logger.error(i18n(`${i18nKey}.noComponents`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    const runnableComponentsByType = componentTypes.reduce((acc, type) => {
      const components = componentsByType[type];

      Object.keys(components).forEach(key => {
        if (components[key].runnable) {
          if (!acc[type]) {
            acc[type] = {};
          }
          acc[type][key] = components[key];
        }
      });

      return acc;
    }, {});

    if (!Object.keys(runnableComponentsByType).length) {
      logger.log();
      logger.error(i18n(`${i18nKey}.noRunnableComponents`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    logger.log();
    await this.devServerSetup(runnableComponentsByType);

    if (!this.debug) {
      console.clear();
    }

    uiBetaMessage(i18n(`${i18nKey}.betaMessage`));
    logger.log();
    logger.log(
      chalk.hex(UI_COLORS.orange)(
        i18n(`${i18nKey}.running`, {
          accountIdentifier: uiAccountDescription(this.targetAccountId),
          projectName: this.projectConfig.name,
        })
      )
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.viewInHubSpotLink`),
        getProjectDetailUrl(this.projectConfig.name, this.targetAccountId)
      )
    );
    logger.log();
    logger.log(i18n(`${i18nKey}.quitHelper`));
    uiLine();
    logger.log();

    await this.devServerStart();

    this.updateKeypressListeners();
  }

  async stop() {
    SpinniesManager.add('cleanupMessage', {
      text: i18n(`${i18nKey}.exitingStart`),
    });

    const cleanupSucceeded = await this.devServerCleanup();

    if (!cleanupSucceeded) {
      SpinniesManager.fail('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingFail`),
      });
      process.exit(EXIT_CODES.ERROR);
    }

    SpinniesManager.succeed('cleanupMessage', {
      text: i18n(`${i18nKey}.exitingSucceed`),
    });
    process.exit(EXIT_CODES.SUCCESS);
  }

  updateKeypressListeners() {
    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        this.stop();
      }
    });
  }

  async devServerSetup(componentsByType) {
    try {
      await DevServerManager.setup({
        alpha: this.alpha,
        componentsByType,
        debug: this.debug,
      });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.setupError`, { message: e.message })
      );
    }
  }

  async devServerStart() {
    try {
      await DevServerManager.start({
        alpha: this.alpha,
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

module.exports = LocalDevManagerV2;
