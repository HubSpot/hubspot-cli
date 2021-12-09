const axios = require('axios');
const { getRequestOptions } = require('../../http/requestOptions');
const { ENVIRONMENTS } = require('../../lib/constants');

const LOCALDEVAUTH_API_AUTH_PATH = 'localdevauth/v1/auth';

async function fetchAccessToken(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  portalId
) {
  const params = portalId ? { portalId } : {};
  const requestOptions = getRequestOptions(
    { env },
    {
      url: `${LOCALDEVAUTH_API_AUTH_PATH}/refresh`,
      data: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      params,
    }
  );

  return axios({ method: 'post', ...requestOptions });
}

module.exports = {
  fetchAccessToken,
};
