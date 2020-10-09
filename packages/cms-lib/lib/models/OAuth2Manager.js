const request = require('request-promise-native');
const moment = require('moment');

const { HubSpotAuthError } = require('./Errors');
const { ENVIRONMENTS } = require('../constants');
const { getHubSpotApiOrigin } = require('../urls');
const { getValidEnv } = require('../environment');

class OAuth2Manager {
  constructor(
    {
      accountId,
      clientId,
      clientSecret,
      scopes,
      environment = ENVIRONMENTS.PROD,
      tokenInfo = { expiresAt: null, refreshToken: null, accessToken: null },
      name,
    },
    logger = console,
    writeTokenInfo
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scopes = scopes;
    this.tokenInfo = tokenInfo;
    this.accountId = accountId;
    this.env = getValidEnv(environment, true);
    this.logger = logger;
    this.writeTokenInfo = writeTokenInfo;
    this.refreshTokenRequest = null;
    this.name = name;
  }

  async accessToken() {
    if (!this.tokenInfo.refreshToken) {
      throw new Error(
        `The account ${this.accountId} has not been authenticated with Oauth2`
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

  async fetchAccessToken(exchangeProof) {
    this.logger.debug(
      `Fetching access token for accountId ${this.accountId} for clientId ${this.clientId}`
    );
    try {
      this.refreshTokenRequest = request.post(
        `${getHubSpotApiOrigin(this.env)}/oauth/v1/token`,
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
          `Persisting updated tokenInfo for accountId ${this.accountId} for clientId ${this.clientId}`
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
          `Waiting for access token for accountId ${this.accountId} for clientId ${this.clientId} to be fetched`
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
      environment: this.env ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD,
      clientSecret: this.clientSecret,
      clientId: this.clientId,
      scopes: this.scopes,
      tokenInfo: this.tokenInfo,
      name: this.name,
    };
  }

  static fromConfig(accountId, accountConfig, logger, writeTokenInfo) {
    const { env, auth, ...rest } = accountConfig;
    if (accountConfig) {
      return new OAuth2Manager(
        {
          ...rest,
          environment: getValidEnv(env),
          ...auth,
        },
        logger,
        writeTokenInfo
      );
    }
    throw new Error(
      `Account Id ${accountId} not found in the config. Did you authorize?`
    );
  }
}

module.exports = OAuth2Manager;
