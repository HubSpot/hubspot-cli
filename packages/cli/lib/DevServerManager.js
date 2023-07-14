const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { getProjectDetailUrl } = require('./projects');
const { i18n } = require('./lang');
const { EXIT_CODES } = require('./enums/exitCodes');
const { logger } = require('@hubspot/cli-lib/logger');

const i18nKey = 'cli.lib.DevServerManager';

const DEFAULT_PORT = 8080;

class DevServerManager {
  constructor() {
    this.initialized = false;
    this.server = null;
    this.path = null;
    this.devServers = {};
  }

  safeLoadServer() {
    try {
      const { DevModeInterface } = require('@hubspot/ui-extensions-dev-server');
      this.devServers['uie'] = DevModeInterface;
    } catch (e) {
      logger.debug('Failed to load dev server interface: ', e);
    }
  }

  async iterateDevServers(callback) {
    const serverKeys = Object.keys(this.devServers);

    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const serverInterface = this.devServers[serverKey];
      await callback(serverInterface, serverKey);
    }
  }

  generateURL(path) {
    return this.path ? `${this.path}/${path}` : null;
  }

  async start({
    accountId,
    debug,
    extension,
    projectConfig,
    projectSourceDir,
  }) {
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

    const projectFiles = await walk(projectSourceDir);

    // Initialize component servers
    await this.iterateDevServers(async serverInterface => {
      if (serverInterface.start) {
        await serverInterface.start({
          accountId,
          debug,
          extension,
          projectConfig,
          projectFiles,
        });
      }
    });

    this.path = this.server.address()
      ? `http://localhost:${this.server.address().port}`
      : null;

    this.initialized = true;
  }

  async cleanup() {
    if (this.initialized) {
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
