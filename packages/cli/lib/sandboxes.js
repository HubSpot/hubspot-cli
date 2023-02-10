const {
  getConfig,
  writeConfig,
  updateAccountConfig,
} = require('@hubspot/cli-lib');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} = require('@hubspot/cli-lib/lib/constants');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { EXIT_CODES } = require('./enums/exitCodes');
const { enterAccountNamePrompt } = require('./prompts/enterAccountNamePrompt');
const {
  personalAccessKeyPrompt,
} = require('./prompts/personalAccessKeyPrompt');
const {
  setAsDefaultAccountPrompt,
} = require('./prompts/setAsDefaultAccountPrompt');
const { uiFeatureHighlight } = require('./ui');

const getSandboxType = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

function getAccountName(config) {
  const isSandbox =
    config.sandboxAccountType && config.sandboxAccountType !== null;
  const sandboxName = `[${getSandboxType(config.sandboxAccountType)} sandbox] `;
  return `${config.name} ${isSandbox ? sandboxName : ''}(${config.portalId})`;
}

function getSyncTasks(config) {
  if (config.sandboxAccountType === 'DEVELOPER') {
    return [{ type: 'object-schemas' }];
  }
  // TODO: fetch types for standard sandbox sync
  return null;
}

const sandboxCreatePersonalAccessKeyFlow = async (env, account, name) => {
  const configData = await personalAccessKeyPrompt({ env, account });
  const updatedConfig = await updateConfigWithPersonalAccessKey(configData);

  if (!updatedConfig) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  let validName = updatedConfig.name;

  if (!updatedConfig.name) {
    const nameForConfig = name
      .toLowerCase()
      .split(' ')
      .join('-');
    const { name: promptName } = await enterAccountNamePrompt(nameForConfig);
    validName = promptName;
  }

  updateAccountConfig({
    ...updatedConfig,
    environment: updatedConfig.env,
    tokenInfo: updatedConfig.auth.tokenInfo,
    name: validName,
  });
  writeConfig();

  const setAsDefault = await setAsDefaultAccountPrompt(validName);

  logger.log('');
  if (setAsDefault) {
    logger.success(
      i18n(`cli.lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
        accountName: validName,
      })
    );
  } else {
    const config = getConfig();
    logger.info(
      i18n(`cli.lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`, {
        accountName: config.defaultPortal,
      })
    );
  }
  logger.success(
    i18n('cli.commands.sandbox.subcommands.create.success.configFileUpdated', {
      configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
      account: validName,
    })
  );
  uiFeatureHighlight([
    'accountsUseCommand',
    'accountOption',
    'accountsListCommand',
  ]);
};

module.exports = {
  getSandboxType,
  getAccountName,
  getSyncTasks,
  sandboxCreatePersonalAccessKeyFlow,
};
