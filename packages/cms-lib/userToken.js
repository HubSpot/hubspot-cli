const open = require('open');
const moment = require('moment');
const {
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
} = require('./lib/config');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  USER_TOKEN_AUTH_METHOD,
} = require('./lib/constants');
const { handleExit } = require('./lib/process');
const { logger } = require('./logger');
const { getAccessToken } = require('./http/userToken');
const {
  promptUser,
  USER_TOKEN_FLOW,
  USER_TOKEN,
} = require('@hubspot/cms-cli/lib/prompts');

const userTokenPrompt = async () => {
  const { name } = await promptUser(USER_TOKEN_FLOW);
  open(`https://app.hubspot.com/l/user-token`);
  const { userToken } = await promptUser(USER_TOKEN);

  return {
    userToken,
    name,
  };
};

const updateConfigWithUserTokenPromptData = async promptData => {
  createEmptyConfigFile();
  handleExit(deleteEmptyConfigFile);
  const { userToken, name } = promptData;
  const response = await getAccessToken(userToken);
  const portalId = response.hubId;
  const accessToken = response.oauthAccessToken;
  const expiresAt = moment(response.expiresAtMillis);

  updatePortalConfig({
    portalId,
    userToken,
    authType: USER_TOKEN_AUTH_METHOD.value,
    tokenInfo: { accessToken, expiresAt },
  });
  updateDefaultPortal(name);
  logger.log(
    `Success: ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} created with ${USER_TOKEN_AUTH_METHOD.name}.`
  );
};

module.exports = {
  userTokenPrompt,
  updateConfigWithUserTokenPromptData,
};
