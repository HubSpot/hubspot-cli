const express = require('express');
const request = require('request-promise-native');
const moment = require('moment');
const open = require('open');

const { HubSpotAuthError } = require('./Errors');

const PORT = 3000;
const redirectUri = `http://localhost:${PORT}/oauth-callback`;

class OAuth2Manager {
  constructor(
    {
      portalId,
      clientId,
      clientSecret,
      scopes,
      environment = 'prod',
      tokenInfo = { expiresAt: null, refreshToken: null, accessToken: null },
    },
    logger = console,
    writeTokenInfo
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scopes = scopes;
    this.tokenInfo = tokenInfo;
    this.portalId = portalId;
    this.env = environment.toLowerCase() === 'prod' ? '' : 'qa';
    this.logger = logger;
    this.writeTokenInfo = writeTokenInfo;
    this.refreshTokenRequest = null;
  }

  buildAuthUrl() {
    return (
      `https://app.hubspot${this.env}.com/oauth/${this.portalId}/authorize` +
      `?client_id=${encodeURIComponent(this.clientId)}` + // app's client ID
      `&scope=${encodeURIComponent(this.scopes.join(' '))}` + // scopes being requested by the app
      `&redirect_uri=${encodeURIComponent(redirectUri)}` // where to send the user after the consent page
    );
  }

  async accessToken() {
    if (!this.tokenInfo.refreshToken) {
      throw new Error(
        `The portal ${this.portalId} has not been authenticated with Oauth2`
      );
    }
    if (
      !this.tokenInfo.accessToken ||
      moment()
        .add(30, 'minutes')
        .isAfter(moment(this.tokenInfo.expiresAt))
    ) {
      await this.refreshAccessToken();
    }
    return this.tokenInfo.accessToken;
  }

  async authorize() {
    open(this.buildAuthUrl());

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      let server;
      const app = express();

      app.get('/oauth-callback', async (req, res) => {
        if (req.query.code) {
          const authCodeProof = {
            grant_type: 'authorization_code',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: redirectUri,
            code: req.query.code,
          };
          try {
            await this.exchangeForTokens(authCodeProof);
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

      server = app.listen(PORT, () =>
        this.logger.log(`Waiting for authorization...`)
      );

      this.handleServerOnProcessEnd(server);
    });
  }

  handleServerOnProcessEnd(server) {
    const shutdownServerIfRunning = () => {
      server && server.close();
    };

    process.on('exit', shutdownServerIfRunning);
    process.on('SIGINT', shutdownServerIfRunning);
  }

  async fetchAccessToken(exchangeProof) {
    this.logger.debug(
      `Fetching access token for portalId ${this.portalId} for clientId ${this.clientId}`
    );
    try {
      this.refreshTokenRequest = request.post(
        `https://api.hubapi${this.env}.com/oauth/v1/token`,
        {
          form: exchangeProof,
          json: true,
        }
      );

      const response = await this.refreshTokenRequest;
      const {
        refresh_token: refreshToken,
        access_token: accessToken,
        expires_in: expiresIn,
      } = response;
      this.tokenInfo.refreshToken = refreshToken;
      this.tokenInfo.accessToken = accessToken;
      this.tokenInfo.expiresAt = moment().add(
        Math.round(expiresIn * 0.75),
        'seconds'
      );
      if (this.writeTokenInfo) {
        this.logger.debug(
          `Persisting updated tokenInfo for portalId ${this.portalId} for clientId ${this.clientId}`
        );
        this.writeTokenInfo(this.tokenInfo);
      }
      this.refreshTokenRequest = null;
    } catch (e) {
      this.refreshTokenRequest = null;
      throw e;
    }
  }

  async exchangeForTokens(exchangeProof) {
    try {
      if (this.refreshTokenRequest) {
        this.logger.debug(
          `Waiting for access token for portalId ${this.portalId} for clientId ${this.clientId} to be fetched`
        );
        await this.refreshTokenRequest;
      } else {
        await this.fetchAccessToken(exchangeProof);
      }
    } catch (e) {
      if (e.response) {
        throw new HubSpotAuthError(
          `Error while retrieving new token: ${e.response.body.message}`
        );
      } else {
        throw e;
      }
    }
  }

  async refreshAccessToken() {
    const refreshTokenProof = {
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.tokenInfo.refreshToken,
    };
    await this.exchangeForTokens(refreshTokenProof);
  }

  toObj() {
    return {
      environment: this.env ? 'qa' : 'prod',
      clientSecret: this.clientSecret,
      clientId: this.clientId,
      scopes: this.scopes,
      tokenInfo: this.tokenInfo,
    };
  }

  static fromConfig(portalId, portalConfig, logger, writeTokenInfo) {
    const { env, auth, ...rest } = portalConfig;
    if (portalConfig) {
      return new OAuth2Manager(
        {
          ...rest,
          environment: env && env.toLowerCase() === 'qa' ? 'qa' : 'prod',
          ...auth,
        },
        logger,
        writeTokenInfo
      );
    }
    throw new Error(
      `Portal Id ${portalId} not found in the config. Did you authorize?`
    );
  }
}

module.exports = OAuth2Manager;
