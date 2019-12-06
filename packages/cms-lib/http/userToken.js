const moment = require('moment');
const request = require('request-promise-native');
const { getRequestOptions } = require('./requestOptions');
const { getPortalConfig, updatePortalConfig } = require('../lib/config');

async function refreshAccessToken(portalId, userToken, env = 'PROD') {
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `oauth/v1/cos-auth/refresh/${userToken}`,
    }
  );

  return request.post(requestOptions);
}

async function accessTokenForUserToken(portalId) {
  const { auth, userToken, env, authType } = getPortalConfig(portalId);

  if (
    !auth ||
    !auth.tokenInfo ||
    !auth.tokenInfo.accessToken ||
    moment()
      .add(30, 'minutes')
      .isAfter(moment(auth.tokenInfo.expiresAt))
  ) {
    let accessToken;
    try {
      accessToken = await refreshAccessToken(portalId, userToken, env);
    } catch (e) {
      console.log(e);
    }
    updatePortalConfig({
      portalId,
      environment: env,
      authType,
      tokenInfo: { accessToken, expiresAt: moment().add(600, 'seconds') },
    });

    return accessToken;
  }

  return auth.tokenInfo.accessToken;
}

module.exports = {
  accessTokenForUserToken,
};
