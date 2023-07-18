const fs = require('fs');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { promptUser } = require('./prompts/promptUtils');
const { DevModeInterface } = require('@hubspot/ui-extensions-dev-server');

const i18nKey = 'cli.lib.DevServerManager';

const APP_COMPONENT_CONFIG = 'app.json';

class DevServerManager {
  constructor() {
    this.debug = false;
    this.initialized = false;
    this.started = false;
    this.devServers = {
      uie: DevModeInterface,
    };
  }

  safeLoadConfigFile(configPath) {
    if (configPath) {
      try {
        const source = fs.readFileSync(configPath);
        const parsedConfig = JSON.parse(source);
        return parsedConfig;
      } catch (e) {
        if (this.debug) {
          logger.error(e);
        }
      }
    }
    return null;
  }

  async iterateDevServers(callback) {
    const serverKeys = Object.keys(this.devServers);

    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const serverInterface = this.devServers[serverKey];
      await callback(serverInterface, serverKey);
    }
  }

  async findComponents(projectSourceDir) {
    let components = {};

    const projectFiles = await walk(projectSourceDir);

    projectFiles.forEach(projectFile => {
      if (projectFile.endsWith(APP_COMPONENT_CONFIG)) {
        const parsedConfig = this.safeLoadConfigFile(projectFile);

        if (parsedConfig && parsedConfig.name) {
          components[parsedConfig.name] = {
            config: parsedConfig,
            path: projectFile.substring(
              0,
              projectFile.indexOf(APP_COMPONENT_CONFIG)
            ),
          };
        }
      }
    });

    return components;
  }

  async setup({ debug, projectSourceDir }) {
    this.debug = debug;

    const components = await this.findComponents(projectSourceDir);

    await this.iterateDevServers(async serverInterface => {
      if (serverInterface.setup) {
        await serverInterface.setup({
          debug,
          promptUser,
          components,
        });
      }
    });

    this.initialized = true;
  }

  async start({ accountId, projectConfig }) {
    if (this.initialized) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.start) {
          await serverInterface.start({
            accountId,
            debug: this.debug,
            projectConfig,
          });
        }
      });
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
    }
  }
}

module.exports = new DevServerManager();
