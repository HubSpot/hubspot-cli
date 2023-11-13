const httpClient = require('@hubspot/cli-lib/http');
const { logger } = require('@hubspot/cli-lib/logger');
const { COMPONENT_TYPES } = require('./projectStructure');
const { i18n } = require('./lang');
const { promptUser } = require('./prompts/promptUtils');
const { DevModeInterface } = require('@hubspot/ui-extensions-dev-server');
const {
  startPortManagerServer,
  portManagerHasActiveServers,
  stopPortManagerServer,
  requestPorts,
} = require('@hubspot/local-dev-lib/portManager');

const i18nKey = 'cli.lib.DevServerManager';

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
    this.devServers = {
      [SERVER_KEYS.app]: {
        componentType: COMPONENT_TYPES.app,
        serverInterface: DevModeInterface,
      },
    };
    this.debug = false;
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

  arrangeComponentsByType(components) {
    return components.reduce((acc, component) => {
      if (!acc[component.type]) {
        acc[component.type] = {};
      }

      acc[component.type][component.config.name] = component;

      return acc;
    }, {});
  }

  async setup({ components, debug, onUploadRequired }) {
    this.debug = debug;
    this.componentsByType = this.arrangeComponentsByType(components);

    await startPortManagerServer();
    await this.iterateDevServers(
      async (serverInterface, compatibleComponents) => {
        if (serverInterface.setup) {
          await serverInterface.setup({
            components: compatibleComponents,
            debug,
            onUploadRequired,
            promptUser,
          });
        }
      }
    );

    this.initialized = true;
  }

  async start({ accountId, projectConfig }) {
    if (this.initialized) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.start) {
          await serverInterface.start({
            accountId,
            debug: this.debug,
            httpClient,
            projectConfig,
            requestPorts,
          });
        }
      });
    } else {
      throw new Error(i18n(`${i18nKey}.notInitialized`));
    }

    this.started = true;
  }

  fileChange({ filePath, event }) {
    if (this.started) {
      this.iterateDevServers(async serverInterface => {
        if (serverInterface.fileChange) {
          await serverInterface.fileChange(filePath, event);
        }
      });
    }
  }

  async cleanup() {
    if (this.started) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.cleanup) {
          await serverInterface.cleanup();
        }
      });

      const hasActiveServers = await portManagerHasActiveServers();

      if (!hasActiveServers) {
        await stopPortManagerServer();
      }
    }
  }
}

module.exports = new DevServerManager();
