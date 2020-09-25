const {
  getEnv,
  updatePortalConfig,
  updateDefaultPortal,
  writeConfig,
} = require('./lib/config');
const { getValidEnv } = require('./lib/environment');
const { PERSONAL_ACCESS_KEY_AUTH_METHOD } = require('./lib/constants');
const { logErrorInstance } = require('./errorHandlers');
const { getAccessToken } = require('./personalAccessKey');
/**
 * Adds a portal to the config using authType: personalAccessKey
 *
 * @param {object} configData Data containing personalAccessKey and name properties
 * @param {string} configData.personalAccessKey Personal access key string to place in config
 * @param {string} configData.name Unique name to identify this config entry
 * @param {boolean} makeDefault option to make the portal being added to the config the default portal
 */
const updateConfigWithPersonalAccessKey = async (configData, makeDefault) => {
  const { personalAccessKey, name, env } = configData;
  const portalEnv = env || getEnv(name);

  let token;
  try {
    token = await getAccessToken(personalAccessKey, portalEnv);
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const { portalId, accessToken, expiresAt } = token;

  const updatedConfig = updatePortalConfig({
    portalId,
    personalAccessKey,
    name,
    environment: getValidEnv(portalEnv, true),
    authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
    tokenInfo: { accessToken, expiresAt },
  });
  writeConfig();

  if (makeDefault) {
    updateDefaultPortal(name);
  }

  return updatedConfig;
};

module.exports = {
  updateConfigWithPersonalAccessKey,
};
