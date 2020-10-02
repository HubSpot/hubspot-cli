const express = require('express');
const open = require('open');
const OAuth2Manager = require('@hubspot/cms-lib/lib/models/OAuth2Manager');
const { getPortalConfig } = require('@hubspot/cms-lib/lib/config');
const { addOauthToPortalConfig } = require('@hubspot/cms-lib/oauth');
const { handleExit } = require('@hubspot/cms-lib/lib/process');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cms-lib/lib/urls');
const { logger } = require('@hubspot/cms-lib/logger');
const { ENVIRONMENTS } = require('@hubspot/cms-lib/lib/constants');

const PORT = 3000;
const redirectUri = `http://localhost:${PORT}/oauth-callback`;

const buildAuthUrl = oauthManager => {
  return (
    `${getHubSpotWebsiteOrigin(oauthManager.env)}/oauth/${
      oauthManager.portalId
    }/authorize` +
    `?client_id=${encodeURIComponent(oauthManager.clientId)}` + // app's client ID
    `&scope=${encodeURIComponent(oauthManager.scopes.join(' '))}` + // scopes being requested by the app
    `&redirect_uri=${encodeURIComponent(redirectUri)}` // where to send the user after the consent page
  );
};

const handleServerOnProcessEnd = server => {
  const shutdownServerIfRunning = () => {
    server && server.close();
  };

  handleExit(shutdownServerIfRunning);
};

const authorize = async oauthManager => {
  open(buildAuthUrl(oauthManager), { url: true });

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    let server;
    const app = express();

    app.get('/oauth-callback', async (req, res) => {
      if (req.query.code) {
        const authCodeProof = {
          grant_type: 'authorization_code',
          client_id: oauthManager.clientId,
          client_secret: oauthManager.clientSecret,
          redirect_uri: redirectUri,
          code: req.query.code,
        };
        try {
          await oauthManager.exchangeForTokens(authCodeProof);
          res.send(`
          <body>
            <h2>Authorization succeeded (you can close this page)</h2>
          </body>
          `);
        } catch (e) {
          res.send(`
          <body>
            <h2>Authorization failed (you can close this page)</h2>
          </body>
          `);
        }
      }
      if (server) {
        server.close();
        server = null;
      }
      if (req.query.code) {
        resolve();
      } else {
        reject();
      }
    });

    server = app.listen(PORT, () => logger.log(`Waiting for authorization...`));

    handleServerOnProcessEnd(server);
  });
};

const setupOauth = (portalId, portalConfig) => {
  const config = getPortalConfig(portalId) || {};
  return new OAuth2Manager(
    {
      ...portalConfig,
      environment: portalConfig.env || config.env || ENVIRONMENTS.PROD,
    },
    logger
  );
};

const authenticateWithOauth = async configData => {
  const portalId = parseInt(configData.portalId, 10);
  const oauthManager = setupOauth(portalId, configData);
  logger.log('Authorizing');
  await authorize(oauthManager);
  addOauthToPortalConfig(portalId, oauthManager);
};

module.exports = {
  authenticateWithOauth,
};
