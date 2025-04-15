import express from 'express';
import open from 'open';
import { OAuth2Manager } from '@hubspot/local-dev-lib/models/OAuth2Manager';
import { addOauthToAccountConfig } from '@hubspot/local-dev-lib/oauth';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { DEFAULT_OAUTH_SCOPES } from '@hubspot/local-dev-lib/constants/auth';
import { Server } from 'http';

import { handleExit } from './process';
import { i18n } from './lang';
import { EXIT_CODES } from './enums/exitCodes';
import { OauthPromptResponse } from './prompts/personalAccessKeyPrompt';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { OAUTH_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { OAuthConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';

const PORT = 3000;
const redirectUri = `http://localhost:${PORT}/oauth-callback`;

const i18nKey = 'lib.oauth';

function buildAuthUrl(oauthManager: OAuth2Manager): string {
  const {
    env: accountEnv,
    auth: { clientId, scopes: accountScopes },
  } = oauthManager.account;

  const env = accountEnv || ENVIRONMENTS.PROD;
  const scopes = accountScopes || DEFAULT_OAUTH_SCOPES;

  if (!clientId) {
    logger.error(i18n(`${i18nKey}.missingClientId`));
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
          client_id: oauthManager.account.auth.clientId,
          client_secret: oauthManager.account.auth.clientSecret,
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

export async function authenticateWithOauth(
  promptData: OauthPromptResponse,
  env: Environment
): Promise<OAuthConfigAccount> {
  const account: OAuthConfigAccount = {
    ...promptData,
    env,
    authType: OAUTH_AUTH_METHOD.value,
    auth: {
      scopes: promptData.scopes,
      clientId: promptData.clientId,
      clientSecret: promptData.clientSecret,
      tokenInfo: {},
    },
  };
  const oauthManager = new OAuth2Manager(account);
  logger.log('Authorizing');
  await authorize(oauthManager);
  addOauthToAccountConfig(oauthManager);
  return account;
}
