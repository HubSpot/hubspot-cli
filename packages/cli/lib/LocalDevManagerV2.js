const path = require('path');
const chalk = require('chalk');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { handleKeypress } = require('@hubspot/cli-lib/lib/process');
const SpinniesManager = require('./SpinniesManager');
const DevServerManager = require('./DevServerManager');
const { EXIT_CODES } = require('./enums/exitCodes');
const { getProjectDetailUrl } = require('./projects');
const { uiAccountDescription, uiLink, uiLine } = require('./ui');

const i18nKey = 'cli.lib.LocalDevManagerV2';

class LocalDevManagerV2 {
  constructor(options) {
    this.targetAccountId = options.targetAccountId;
    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.extension = options.extension;
    this.debug = options.debug || false;

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
    console.clear();
    SpinniesManager.removeAll();
    SpinniesManager.init();

    logger.log(
      chalk.hex('#9784c2')(i18n(`${i18nKey}.betaTag`)),
      i18n(`${i18nKey}.betaMessage`)
    );
    logger.log();
    logger.log(
      chalk.hex('#FF8F59')(
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

    await this.devServerCleanup();

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

  async devServerStart() {
    try {
      DevServerManager.safeLoadServer();
      await DevServerManager.start({
        accountId: this.targetAccountId,
        debug: this.debug,
        extension: this.extension,
        projectConfig: this.projectConfig,
        projectSourceDir: this.projectSourceDir,
      });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      SpinniesManager.add(null, {
        text: i18n(`${i18nKey}.devServer.startError`),
        status: 'non-spinnable',
      });
    }
  }

  async devServerCleanup() {
    try {
      await DevServerManager.cleanup();
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      SpinniesManager.add(null, {
        text: i18n(`${i18nKey}.devServer.cleanupError`),
        status: 'non-spinnable',
      });
    }
  }
}

module.exports = LocalDevManagerV2;
