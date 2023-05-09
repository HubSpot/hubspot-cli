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

  async getProjectFiles(projectSourceDir) {
    const projectFiles = await walk(projectSourceDir);
    return projectFiles;
  }

  async start({ projectConfig, projectSourceDir, spinnies }) {
    const projectFiles = await this.getProjectFiles(projectSourceDir);

    await this.iterateServers(async (serverInterface, serverKey) => {
      if (serverInterface.start) {
        await serverInterface.start(serverKey, {
          projectConfig,
          projectSourceDir,
          projectFiles,
          spinnies,
        });
      }
    });
  }

  async notify(changeInfo) {
    let notifyResponse = { uploadRequired: true };

    await this.iterateServers(async (serverInterface, serverKey) => {
      let isSupportedByServer = false;

      if (serverInterface.notify) {
        isSupportedByServer = await serverInterface.notify(changeInfo);
      }

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
      if (notifyResponse[serverKey] && serverInterface.execute) {
        await serverInterface.execute(changeInfo);
      }
    });
  }

  async cleanup() {
    await this.iterateServers(async serverInterface => {
      if (serverInterface.cleanup) {
        await serverInterface.cleanup();
      }
    });
  }
}

module.exports = new DevServerManager();
