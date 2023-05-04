const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const UIEDevServerInterface = require('../../../../ui-extensibility/public-packages/ui-extensions-dev-server/cliInterface');

class DevServerManager {
  constructor() {
    this.servers = {
      uie: UIEDevServerInterface,
    };
  }

  async iterateServers(callback) {
    const serverKeys = Object.keys(this.servers);

    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const serverInterface = this.servers[serverKey];
      await callback(serverInterface, serverKey);
    }
  }

  //TODO we should not keep this around long-term
  async loadAppConfigFromPath(projectSourceDir) {
    const projectFiles = await walk(projectSourceDir);
    const appConfigPath = projectFiles.find(file => file.endsWith('app.json'));
    if (appConfigPath) {
      try {
        const source = fs.readFileSync(appConfigPath);
        const parsed = yaml.load(source);
        return { appConfigPath, parsed };
      } catch (e) {
        console.log(e);
      }
    }
    return { appConfigPath: null, parsed: null };
  }

  async start({ projectConfig, projectSourceDir }) {
    const appConfig = await this.loadAppConfigFromPath(projectSourceDir);

    await this.iterateServers(async (serverInterface, serverKey) => {
      await serverInterface.start(serverKey, {
        projectConfig,
        projectSourceDir,
        appConfig: appConfig.parsed,
        appPath: path.dirname(appConfig.appConfigPath),
      });
    });
  }

  async notify(changeInfo) {
    let notifyResponse = { uploadRequired: true };

    await this.iterateServers(async (serverInterface, serverKey) => {
      const isSupportedByServer = await serverInterface.notify(changeInfo);
      if (isSupportedByServer) {
        notifyResponse[serverKey] = true;

        if (notifyResponse.uploadRequired) {
          notifyResponse.uploadRequired = false;
        }
      }
    });

    return notifyResponse;
  }

  async execute(notifyResponse, changeInfo) {
    await this.iterateServers(async (serverInterface, serverKey) => {
      if (notifyResponse[serverKey]) {
        await serverInterface.execute(changeInfo);
      }
    });
  }

  async cleanup() {
    await this.iterateServers(async serverInterface => {
      await serverInterface.cleanup();
    });
  }
}

module.exports = new DevServerManager();
