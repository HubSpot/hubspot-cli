const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { getProjectDetailUrl } = require('./projects');

const DEFAULT_PORT = 8080;

class DevServerManager {
  constructor() {
    this.server = null;
    this.devServers = {};
  }

  async iterateDevServers(callback) {
    const serverKeys = Object.keys(this.devServers);

    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const serverInterface = this.devServers[serverKey];
      await callback(serverInterface, serverKey);
    }
  }

  async getProjectFiles(projectSourceDir) {
    const projectFiles = await walk(projectSourceDir);
    return projectFiles;
  }

  async start({ accountId, projectConfig, projectSourceDir, port }) {
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

    const projectFiles = await this.getProjectFiles(projectSourceDir);

    // Initialize component servers
    await this.iterateDevServers(async (serverInterface, serverKey) => {
      if (serverInterface.start) {
        const serverApp = await serverInterface.start(serverKey, {
          projectConfig,
          projectSourceDir,
          projectFiles,
        });
        app.use(`/${serverKey}`, serverApp);
      }
    });

    // Start server
    this.server = app.listen(port || DEFAULT_PORT);

    return this.server.address()
      ? `http://localhost:${this.server.address().port}`
      : null;
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

  async execute(changeInfo, notifyResponse) {
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
    console.log('what');
    if (this.server) {
      await this.server.close();
    }
    console.log('server closed');
  }
}

module.exports = new DevServerManager();
