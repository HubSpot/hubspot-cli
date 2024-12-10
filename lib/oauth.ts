import express from 'express';
import open from 'open';
import { OAuth2Manager } from '@hubspot/local-dev-lib/models/OAuth2Manager';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { addOauthToAccountConfig } from '@hubspot/local-dev-lib/oauth';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { Server } from 'http';

import { handleExit } from './process';
import { i18n } from './lang';

const PORT = 3000;
const redirectUri = `http://localhost:${PORT}/oauth-callback`;

const i18nKey = 'lib.oauth';

function buildAuthUrl(oauthManager: OAuth2Manager): string {
  const { env, clientId, scopes } = oauthManager.account;

  if (!(env && clientId && scopes)) {
    throw new Error(i18n(`${i18nKey}.buildAuthUrlError`));
  }

  return (
    `${getHubSpotWebsiteOrigin(env)}/oauth/${
      oauthManager.account.accountId
    }/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` + // app's client ID
    `&scope=${encodeURIComponent(scopes.join(' '))}` + // scopes being requested by the app
    `&redirect_uri=${encodeURIComponent(redirectUri)}` // where to send the user after the consent page
  );
}

function handleServerOnProcessEnd(server: Server): void {
  const shutdownServerIfRunning = () => {
    server?.close();
  };

  handleExit(shutdownServerIfRunning);
}

async function authorize(oauthManager: OAuth2Manager): Promise<void> {
  if (process.env.BROWSER !== 'none') {
    open(buildAuthUrl(oauthManager), { url: true });
  }

  // eslint-disable-next-line no-async-promise-executor
  return new Promise<void>(async (resolve, reject) => {
    let server: Server | null;
    const app = express();

    app.get('/oauth-callback', async (req, res) => {
      if (req.query.code) {
        const authCodeProof = {
          grant_type: 'authorization_code',
          client_id: oauthManager.account.clientId,
          client_secret: oauthManager.account.clientSecret,
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
}

function setupOauth(accountConfig): OAuth2Manager {
  const id = getAccountIdentifier(accountConfig);
  const accountId = parseInt(id, 10);
  const config = getAccountConfig(accountId) || {};
  return new OAuth2Manager({
    ...accountConfig,
    environment: accountConfig.env || config.env || ENVIRONMENTS.PROD,
  });
}

export async function authenticateWithOauth(accountConfig) {
  const oauthManager = setupOauth(accountConfig);
  logger.log('Authorizing');
  await authorize(oauthManager);
  addOauthToAccountConfig(oauthManager);
}
