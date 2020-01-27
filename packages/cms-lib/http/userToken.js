const moment = require('moment');
const request = require('request-promise-native');
const { HubSpotAuthError } = require('@hubspot/api-auth-lib/Errors');

const { getRequestOptions } = require('./requestOptions');
const { getPortalConfig, updatePortalConfig } = require('../lib/config');

async function refreshAccessToken(portalId, userToken, env = 'PROD') {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `localdevauth/v1/auth/refresh`,
      body: {
        encodedOAuthRefreshToken: userToken,
      },
    }
  );

  return request.post(requestOptions);
}

async function accessTokenForUserToken(portalId) {
  const { auth, userToken, env, ...rest } = getPortalConfig(portalId);

  if (
    !auth ||
    !auth.tokenInfo ||
    !auth.tokenInfo.accessToken ||
    moment()
      .add(30, 'minutes')
      .isAfter(moment(auth.tokenInfo.expiresAt))
  ) {
    let response;
    try {
      response = await refreshAccessToken(portalId, userToken, env);
    } catch (e) {
      if (e.response) {
        throw new HubSpotAuthError(
          `Error while retrieving new access token: ${e.response.body.message}`
        );
      } else {
        throw e;
      }
    }
    const accessToken = response.oauthAccessToken;
    updatePortalConfig({
      ...rest,
      portalId,
      environment: env,
      tokenInfo: { accessToken, expiresAt: moment().add(600, 'seconds') },
    });

    return accessToken;
  }

  return auth.tokenInfo.accessToken;
}

module.exports = {
  accessTokenForUserToken,
};
