const { logger } = require('../logger');
const {
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('../lib/constants');

const generatePersonalAccessKeyConfig = ({
  accountId,
  personalAccessKey,
  env,
}) => {
  return {
    accounts: [
      {
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        accountId,
        personalAccessKey,
        env,
      },
    ],
  };
};

const generateOauthConfig = ({
  accountId,
  clientId,
  clientSecret,
  refreshToken,
  scopes,
  env,
}) => {
  return {
    accounts: [
      {
        authType: OAUTH_AUTH_METHOD.value,
        accountId,
        auth: {
          clientId,
          clientSecret,
          scopes,
          tokenInfo: {
            refreshToken,
          },
        },
        env,
      },
    ],
  };
};

const generateApiKeyConfig = ({ accountId, apiKey, env }) => {
  return {
    accounts: [
      {
        authType: API_KEY_AUTH_METHOD.value,
        accountId,
        apiKey,
        env,
      },
    ],
  };
};

const generateNewConfig = (type, options = {}) => {
  switch (type) {
    case API_KEY_AUTH_METHOD.value:
      return generateApiKeyConfig(options);
    case PERSONAL_ACCESS_KEY_AUTH_METHOD.value:
      return generatePersonalAccessKeyConfig(options);
    case OAUTH_AUTH_METHOD.value:
      return generateOauthConfig(options);
    default:
      logger.debug(`Unknown type of "${type}".`);
      return null;
  }
};

module.exports = generateNewConfig;
