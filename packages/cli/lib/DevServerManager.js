const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { getProjectDetailUrl } = require('./projects');

const PORT = 8080;

class DevServerManager {
  constructor() {
    this.servers = {};
  }

  startServer(accountId, projectConfig) {
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
    app.get('/hs/details', (req, res) => {
      res.redirect(getProjectDetailUrl(projectConfig.name, accountId));
    });

    // Start server
    app.listen(PORT);
  }

  async start({ projectConfig, accountId }) {
    this.startServer(accountId, projectConfig);
    return;
  }

  async notify() {
    return;
  }

  async execute() {
    return;
  }

  async cleanup() {
    return;
  }
}

module.exports = new DevServerManager();
