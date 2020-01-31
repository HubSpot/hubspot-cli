const moment = require('moment');
const { HubSpotAuthError } = require('@hubspot/api-auth-lib/Errors');
const { fetchAccessToken } = require('../api/localDevAuth');

const { getPortalConfig, updatePortalConfig } = require('../lib/config');

const refreshRequests = new Map();

async function refreshAccessToken(portalId, userToken, env = 'PROD') {
  const config = getPortalConfig(portalId);
  let response;
  try {
    response = await fetchAccessToken(userToken, env);
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
  const expiresAt = moment(response.expiresAtMillis);
  updatePortalConfig({
    ...config,
    portalId,
    environment: env,
    tokenInfo: { accessToken, expiresAt },
  });

  return accessToken;
}

async function accessTokenForUserToken(portalId) {
  const { auth, userToken, env } = getPortalConfig(portalId);

  if (
    !auth ||
    !auth.tokenInfo ||
    !auth.tokenInfo.accessToken ||
    moment()
      .add(30, 'minutes')
      .isAfter(moment(auth.tokenInfo.expiresAt))
  ) {
    const key = `${userToken}-${auth.tokenInfo.expiresAt}`;
    if (refreshRequests.has(key)) {
      return refreshRequests.get(key);
    }
    let accessToken;
    try {
      const refreshAccessPromise = refreshAccessToken(portalId, userToken, env);
      refreshRequests.set(userToken, refreshAccessPromise);
      accessToken = await refreshAccessPromise;
    } catch (e) {
      refreshRequests.delete(key);
      throw e;
    }
    return accessToken;
  }

  return auth.tokenInfo.accessToken;
}

module.exports = {
  accessTokenForUserToken,
};
