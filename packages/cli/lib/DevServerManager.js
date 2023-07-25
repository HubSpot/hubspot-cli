const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const httpClient = require('@hubspot/cli-lib/http');
const { logger } = require('@hubspot/cli-lib/logger');
const { getProjectDetailUrl } = require('./projects');
const { COMPONENT_TYPES } = require('./projectStructure');
const { i18n } = require('./lang');
const { EXIT_CODES } = require('./enums/exitCodes');
const { promptUser } = require('./prompts/promptUtils');

const i18nKey = 'cli.lib.DevServerManager';

const DEFAULT_PORT = 8080;
const SERVER_KEYS = {
  app: 'app',
};

class DevServerManager {
  constructor() {
    this.initialized = false;
    this.started = false;
    this.componentsByType = {};
    this.server = null;
    this.path = null;
    this.devServers = {};
    this.debug = false;
  }

  safeLoadServer() {
    try {
      const { DevModeInterface } = require('@hubspot/ui-extensions-dev-server');
      this.devServers[SERVER_KEYS.app] = {
        componentType: COMPONENT_TYPES.app,
        serverInterface: DevModeInterface,
      };
    } catch (e) {
      logger.debug('Failed to load dev server interface: ', e);
    }
  }

  async iterateDevServers(callback) {
    const serverKeys = Object.keys(this.devServers);

    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const devServer = this.devServers[serverKey];

      const compatibleComponents =
        this.componentsByType[devServer.componentType] || {};

      if (Object.keys(compatibleComponents).length) {
        await callback(devServer.serverInterface, compatibleComponents);
      } else {
        logger.debug(i18n(`${i18nKey}.noCompatibleComponents`, { serverKey }));
      }
    }
  }

  generateURL(path) {
    return this.path ? `${this.path}/${path}` : null;
  }

  async setup({ alpha, componentsByType, debug, onUploadRequired }) {
    this.debug = debug;
    this.componentsByType = componentsByType;

    this.safeLoadServer();

    await this.iterateDevServers(async (serverInterface, components) => {
      if (serverInterface.setup) {
        await serverInterface.setup({
          alpha,
          components,
          debug,
          onUploadRequired,
          promptUser,
        });
      }
    });

    this.initialized = true;
  }

  async start({ alpha, accountId, projectConfig }) {
    if (this.initialized) {
      const app = express();

      // Install Middleware
      app.use(bodyParser.json({ limit: '50mb' }));
      app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
      app.use(cors());

      // Configure
      app.set('trust proxy', true);

      // Initialize a base route
      app.get('/', (req, res) => {
        res.send('HubSpot local dev server');
      });

      // Initialize URL redirects
      app.get('/hs/project', (req, res) => {
        res.redirect(getProjectDetailUrl(projectConfig.name, accountId));
      });

      // Start server
      this.server = await app.listen(DEFAULT_PORT).on('error', err => {
        if (err.code === 'EADDRINUSE') {
          logger.error(i18n(`${i18nKey}.portConflict`, { port: DEFAULT_PORT }));
          logger.log();
          process.exit(EXIT_CODES.ERROR);
        }
      });

      // Initialize component servers
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.start) {
          await serverInterface.start({
            alpha,
            accountId,
            debug: this.debug,
            httpClient,
            projectConfig,
          });
        }
      });

      this.path = this.server.address()
        ? `http://localhost:${this.server.address().port}`
        : null;
    } else {
      throw new Error(i18n(`${i18nKey}.notInitialized`));
    }

    this.started = true;
  }

  async cleanup() {
    if (this.started) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.cleanup) {
          await serverInterface.cleanup();
        }
      });

      if (this.server) {
        await this.server.close();
      }
    }
  }
}

module.exports = new DevServerManager();
