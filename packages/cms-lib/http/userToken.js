const moment = require('moment');
const { HubSpotAuthError } = require('@hubspot/api-auth-lib/Errors');
const { fetchAccessToken } = require('../api/localDevAuth');

const { getPortalConfig, updatePortalConfig } = require('../lib/config');

const refreshRequests = new Map();

function getRefreshKeyForUserToken(userToken, expiration) {
  return `${userToken}-${expiration || 'fresh'}`;
}

async function getAccessToken(userToken, env = 'PROD') {
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

  return response;
}

async function refreshAccessToken(userToken, env = 'PROD') {
  const response = await getAccessToken(userToken, env);
  const portalId = response.hubId;
  const accessToken = response.oauthAccessToken;
  const expiresAt = moment(response.expiresAtMillis);

  updateTokenInfoForPortal(
    {
      accessToken,
      expiresAt,
    },
    portalId
  );

  return accessToken;
}

function updateTokenInfoForPortal(tokenInfo, portalId) {
  const config = getPortalConfig(portalId);

  updatePortalConfig({
    ...config,
    portalId,
    tokenInfo,
  });
}

async function getNewAccessToken(userToken, authTokenInfo, env) {
  const key = getRefreshKeyForUserToken(
    userToken,
    authTokenInfo && authTokenInfo.expiresAt
  );
  if (refreshRequests.has(key)) {
    return refreshRequests.get(key);
  }
  let accessToken;
  try {
    const refreshAccessPromise = refreshAccessToken(userToken, env);
    if (key) {
      refreshRequests.set(key, refreshAccessPromise);
    }
    accessToken = await refreshAccessPromise;
  } catch (e) {
    if (key) {
      refreshRequests.delete(key);
    }
    throw e;
  }
  return accessToken;
}

async function accessTokenForUserToken(portalId) {
  const { auth, userToken, env } = getPortalConfig(portalId);
  const authTokenInfo = auth && auth.tokenInfo;
  const authDataExists = authTokenInfo && auth.tokenInfo.accessToken;

  if (
    !authDataExists ||
    moment()
      .add(30, 'minutes')
      .isAfter(moment(authTokenInfo.expiresAt))
  ) {
    return getNewAccessToken(
      userToken,
      authTokenInfo && authTokenInfo.expiresAt,
      env
    );
  }

  return auth.tokenInfo.accessToken;
}

module.exports = {
  getAccessToken,
  accessTokenForUserToken,
};
