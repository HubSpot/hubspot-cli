const { logger } = require('@hubspot/local-dev-lib/logger');
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
const {
  getHubSpotApiOrigin,
  getHubSpotWebsiteOrigin,
} = require('@hubspot/local-dev-lib/urls');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');

const i18nKey = 'cli.lib.DevServerManager';

const COMPONENT_KEYS = {
  privateApp: 'privateApp',
  publicApp: 'publicApp',
};

const SERVER_IDS = {
  UIE_DEV_SERVER: 'UIE_DEV_SERVER',
};

class DevServerManager {
  constructor() {
    this.initialized = false;
    this.started = false;
    this.componentsByType = {};
    this.server = null;
    this.path = null;
    this.devServers = {
      [COMPONENT_KEYS.privateApp]: {
        componentType: COMPONENT_TYPES.privateApp,
        serverInterface: DevModeInterface,
        id: SERVER_IDS.UIE_DEV_SERVER,
      },
      [COMPONENT_KEYS.publicApp]: {
        componentType: COMPONENT_TYPES.publicApp,
        serverInterface: DevModeInterface,
        id: SERVER_IDS.UIE_DEV_SERVER,
      },
    };
  }

  async iterateDevServers(callback) {
    const componentKeys = Object.keys(this.devServers);
    const iteratedServerIds = [];

    for (let i = 0; i < componentKeys.length; i++) {
      const componentKey = componentKeys[i];
      const devServer = this.devServers[componentKey];

      const compatibleComponents =
        this.componentsByType[devServer.componentType] || {};

      if (
        Object.keys(compatibleComponents).length &&
        !iteratedServerIds.includes(devServer.id)
      ) {
        iteratedServerIds.push(devServer.id);
        await callback(devServer.serverInterface, compatibleComponents);
      } else {
        logger.debug(
          i18n(`${i18nKey}.noCompatibleComponents`, { componentKey })
        );
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

  async setup({ components, onUploadRequired, accountId }) {
    this.componentsByType = this.arrangeComponentsByType(components);
    const { env } = getAccountConfig(accountId);
    await startPortManagerServer();
    await this.iterateDevServers(
      async (serverInterface, compatibleComponents) => {
        if (serverInterface.setup) {
          await serverInterface.setup({
            components: compatibleComponents,
            onUploadRequired,
            promptUser,
            logger,
            urls: {
              api: getHubSpotApiOrigin(env),
              web: getHubSpotWebsiteOrigin(env),
            },
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
