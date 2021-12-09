const moment = require('moment');
const { HubSpotAuthError } = require('./lib/models/Errors');
const {
  getEnv,
  getAccountConfig,
  updateAccountConfig,
  updateDefaultAccount,
  writeConfig,
} = require('./lib/config');
const { getValidEnv } = require('./lib/environment');
const {
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  ENVIRONMENTS,
} = require('./lib/constants');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { fetchAccessToken } = require('./api/localDevAuth/unauthenticated');

const refreshRequests = new Map();

function getRefreshKey(personalAccessKey, expiration) {
  return `${personalAccessKey}-${expiration || 'fresh'}`;
}

async function getAccessToken(
  personalAccessKey,
  env = ENVIRONMENTS.PROD,
  accountId
) {
  let response;
  try {
    const { data } = await fetchAccessToken(personalAccessKey, env, accountId);
    response = data;
  } catch (e) {
    if (e.response) {
      const errorOutput = `Error while retrieving new access token: ${e.response.body.message}.`;
      if (e.response.statusCode === 401) {
        throw new HubSpotAuthError(
          `${errorOutput} \nYour personal access key is invalid. Please run "hs auth personalaccesskey" to reauthenticate. See https://designers.hubspot.com/docs/personal-access-keys for more information.`
        );
      } else {
        throw new HubSpotAuthError(errorOutput);
      }
    } else {
      throw e;
    }
  }
  return {
    portalId: response.hubId,
    accessToken: response.oauthAccessToken,
    expiresAt: moment(response.expiresAtMillis),
    scopeGroups: response.scopeGroups,
    encodedOauthRefreshToken: response.encodedOauthRefreshToken,
  };
}

async function refreshAccessToken(
  accountId,
  personalAccessKey,
  env = ENVIRONMENTS.PROD
) {
  const { accessToken, expiresAt } = await getAccessToken(
    personalAccessKey,
    env,
    accountId
  );
  const config = getAccountConfig(accountId);

  updateAccountConfig({
    ...config,
    portalId: accountId,
    tokenInfo: {
      accessToken,
      expiresAt: expiresAt.toISOString(),
    },
  });
  writeConfig();

  return accessToken;
}

async function getNewAccessToken(accountId, personalAccessKey, expiresAt, env) {
  const key = getRefreshKey(personalAccessKey, expiresAt);
  if (refreshRequests.has(key)) {
    return refreshRequests.get(key);
  }
  let accessToken;
  try {
    const refreshAccessPromise = refreshAccessToken(
      accountId,
      personalAccessKey,
      env
    );
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

async function accessTokenForPersonalAccessKey(accountId) {
  const { auth, personalAccessKey, env } = getAccountConfig(accountId);
  const authTokenInfo = auth && auth.tokenInfo;
  const authDataExists = authTokenInfo && auth.tokenInfo.accessToken;

  if (
    !authDataExists ||
    moment()
      .add(5, 'minutes')
      .isAfter(moment(authTokenInfo.expiresAt))
  ) {
    return getNewAccessToken(
      accountId,
      personalAccessKey,
      authTokenInfo && authTokenInfo.expiresAt,
      env
    );
  }

  return auth.tokenInfo.accessToken;
}

/**
 * Adds a account to the config using authType: personalAccessKey
 *
 * @param {object} configData Data containing personalAccessKey and name properties
 * @param {string} configData.personalAccessKey Personal access key string to place in config
 * @param {string} configData.name Unique name to identify this config entry
 * @param {boolean} makeDefault option to make the account being added to the config the default account
 */
const updateConfigWithPersonalAccessKey = async (configData, makeDefault) => {
  const { personalAccessKey, name, env } = configData;
  const accountEnv = env || getEnv(name);

  let token;
  try {
    token = await getAccessToken(personalAccessKey, accountEnv);
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const { portalId, accessToken, expiresAt } = token;

  const updatedConfig = updateAccountConfig({
    portalId,
    personalAccessKey,
    name,
    environment: getValidEnv(accountEnv, true),
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    tokenInfo: { accessToken, expiresAt },
  });
  writeConfig();

  if (makeDefault) {
    updateDefaultAccount(name);
  }

  return updatedConfig;
};

module.exports = {
  accessTokenForPersonalAccessKey,
  updateConfigWithPersonalAccessKey,
};
