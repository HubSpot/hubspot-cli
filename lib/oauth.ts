import express from 'express';
import open from 'open';
import { OAuth2Manager } from '@hubspot/local-dev-lib/models/OAuth2Manager';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { addOauthToAccountConfig } from '@hubspot/local-dev-lib/oauth';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_OAUTH_SCOPES } from '@hubspot/local-dev-lib/constants/auth';
import { OAuth2ManagerAccountConfig } from '@hubspot/local-dev-lib/types/Accounts';
import { Server } from 'http';

import { handleExit } from './process.js';
import { i18n } from './lang.js';
import { EXIT_CODES } from './enums/exitCodes.js';

const PORT = 3000;
const redirectUri = `http://localhost:${PORT}/oauth-callback`;

function buildAuthUrl(oauthManager: OAuth2Manager): string {
  const {
    env: accountEnv,
    clientId,
    scopes: accountScopes,
  } = oauthManager.account;

  const env = accountEnv || ENVIRONMENTS.PROD;
  const scopes = accountScopes || DEFAULT_OAUTH_SCOPES;

  if (!clientId) {
    logger.error(i18n(`lib.oauth.missingClientId`));
    process.exit(EXIT_CODES.ERROR);
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

function setupOauth(accountConfig: OAuth2ManagerAccountConfig): OAuth2Manager {
  const accountId = getAccountIdentifier(accountConfig);
  const config = getAccountConfig(accountId);
  return new OAuth2Manager({
    ...accountConfig,
    env: accountConfig.env || config?.env || ENVIRONMENTS.PROD,
  });
}

export async function authenticateWithOauth(
  accountConfig: OAuth2ManagerAccountConfig
): Promise<void> {
  const oauthManager = setupOauth(accountConfig);
  logger.log('Authorizing');
  await authorize(oauthManager);
  addOauthToAccountConfig(oauthManager);
}
