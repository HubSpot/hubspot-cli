const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
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

  async start({ projectConfig, accountId, port }) {
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
    app.get('/hs/learnMore', (req, res) => {
      //TODO link to docs
      res.redirect(getProjectDetailUrl(projectConfig.name, accountId));
    });

    // Initialize component servers
    await this.iterateDevServers(async (serverInterface, serverKey) => {
      if (serverInterface.start) {
        const serverApp = await serverInterface.start(serverKey);
        app.use(`/${serverKey}`, serverApp);
      }
    });

    // Start server
    this.server = app.listen(port || DEFAULT_PORT);

    return this.server.address()
      ? `http://localhost:${this.server.address().port}`
      : null;
  }

  async notify() {
    return { uploadRequired: true };
  }

  async execute() {
    return;
  }

  async cleanup() {
    if (this.server) {
      await this.server.close();
    }
  }
}

module.exports = new DevServerManager();
