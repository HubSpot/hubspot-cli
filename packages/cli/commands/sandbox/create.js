const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');

const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { createSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  ENVIRONMENTS,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
} = require('@hubspot/cli-lib/lib/constants');
const {
  personalAccessKeyPrompt,
} = require('../../lib/prompts/personalAccessKeyPrompt');
const {
  updateConfigWithPersonalAccessKey,
} = require('@hubspot/cli-lib/personalAccessKey');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const {
  writeConfig,
  updateAccountConfig,
  getAccountConfig,
} = require('@hubspot/cli-lib');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { accountNameExistsInConfig } = require('@hubspot/cli-lib/lib/config');
const { STRING_WITH_NO_SPACES_REGEX } = require('../../lib/regex');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  isMissingScopeError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

const promptForAccountNameIfNotSet = async (updatedConfig, name) => {
  if (!updatedConfig.name) {
    let promptAnswer;
    let validName = null;
    while (!validName) {
      promptAnswer = await promptUser([
        {
          name: 'name',
          message: i18n(`${i18nKey}.enterAccountName`),
          validate(val) {
            if (typeof val !== 'string') {
              return i18n(`${i18nKey}.errors.invalidName`);
            } else if (!val.length) {
              return i18n(`${i18nKey}.errors.nameRequired`);
            } else if (!STRING_WITH_NO_SPACES_REGEX.test(val)) {
              return i18n(`${i18nKey}.errors.spacesInName`);
            }
            return true;
          },
          default: name,
        },
      ]);

      if (!accountNameExistsInConfig(promptAnswer.name)) {
        validName = promptAnswer.name;
      } else {
        logger.log(
          i18n(`${i18nKey}.errors.accountNameExists`, {
            name: promptAnswer.name,
          })
        );
      }
    }
    return validName;
  }
};

const personalAccessKeyFlow = async (env, account, name) => {
  const configData = await personalAccessKeyPrompt({ env, account });
  const updatedConfig = await updateConfigWithPersonalAccessKey(configData);

  if (!updatedConfig) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  const validName = await promptForAccountNameIfNotSet(updatedConfig, name);

  updateAccountConfig({
    ...updatedConfig,
    environment: updatedConfig.env,
    tokenInfo: updatedConfig.auth.tokenInfo,
    name: validName,
  });
  writeConfig();
  logger.success(
    i18n(`${i18nKey}.success.configFileUpdated`, {
      configFilename: DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      authMethod: PERSONAL_ACCESS_KEY_AUTH_METHOD.name,
      account: validName,
    })
  );
};

exports.command = 'create [name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  let namePrompt;

  trackCommandUsage('sandbox-create', {}, accountId);

  if (!name) {
    namePrompt = await createSandboxPrompt();
  }

  const sandboxName = name || namePrompt.name;

  logger.debug(
    i18n(`${i18nKey}.debug.creating`, {
      name: sandboxName,
    })
  );
  let result;
  try {
    result = await createSandbox(accountId, sandboxName).then(
      ({ name, sandboxHubId }) => {
        logger.success(
          i18n(`${i18nKey}.success.create`, {
            name,
            sandboxHubId,
          })
        );
        return { name, sandboxHubId };
      }
    );
  } catch (err) {
    if (isMissingScopeError(err)) {
      logger.error(
        i18n(`${i18nKey}.failure.scopes.message`, {
          accountName: accountConfig.name || accountId,
        })
      );
      const websiteOrigin = getHubSpotWebsiteOrigin(env);
      const url = `${websiteOrigin}/personal-access-key/${accountId}`;
      logger.info(
        i18n(`${i18nKey}.failure.scopes.instructions`, {
          accountName: accountConfig.name || accountId,
          url,
        })
      );
    }
    process.exit(EXIT_CODES.ERROR);
  }
  try {
    await personalAccessKeyFlow(env, result.sandboxHubId, result.name);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logErrorInstance(err);
  }
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.example([
    ['$0 sandbox create MySandboxAccount', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
