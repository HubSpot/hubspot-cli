const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');
const Spinnies = require('spinnies');
const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { createSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const { getSandboxType } = require('../../lib/sandboxes');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { logErrorInstance } = require('@hubspot/cli-lib/errorHandlers');
const {
  debugErrorAndContext,
} = require('@hubspot/cli-lib/errorHandlers/standardErrors');
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
  getConfig,
  writeConfig,
  updateAccountConfig,
  getAccountConfig,
} = require('@hubspot/cli-lib');
const {
  enterAccountNamePrompt,
} = require('../../lib/prompts/enterAccountNamePrompt');
const {
  setAsDefaultAccountPrompt,
} = require('../../lib/prompts/setAsDefaultAccountPrompt');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cli-lib/lib/urls');
const {
  isMissingScopeError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');
const { uiFeatureHighlight } = require('../../lib/ui');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

const personalAccessKeyFlow = async (env, account, name) => {
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
    i18n(`${i18nKey}.success.configFileUpdated`, {
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

exports.command = 'create [--name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });

  trackCommandUsage('sandbox-create', null, accountId);

  if (
    accountConfig.sandboxAccountType &&
    accountConfig.sandboxAccountType !== null
  ) {
    trackCommandUsage('sandbox-create', { successful: false }, accountId);

    logger.error(
      i18n(`${i18nKey}.failure.creatingWithinSandbox`, {
        sandboxType: getSandboxType(accountConfig.sandboxAccountType),
      })
    );

    process.exit(EXIT_CODES.ERROR);
  }

  let namePrompt;

  logger.log(i18n(`${i18nKey}.sandboxLimitation`));
  logger.log('');

  if (!name) {
    namePrompt = await createSandboxPrompt();
  }

  const sandboxName = name || namePrompt.name;

  let result;

  try {
    spinnies.add('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.add`, {
        sandboxName,
      }),
    });

    result = await createSandbox(accountId, sandboxName);

    logger.log('');
    spinnies.succeed('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.succeed`, {
        name: result.name,
        sandboxHubId: result.sandboxHubId,
      }),
    });
  } catch (err) {
    debugErrorAndContext(err);

    trackCommandUsage('sandbox-create', { successful: false }, accountId);

    spinnies.fail('sandboxCreate', {
      text: i18n(`${i18nKey}.loading.fail`, {
        sandboxName,
      }),
    });

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
    } else {
      logger.error(err.error.message);
    }
    process.exit(EXIT_CODES.ERROR);
  }
  try {
    await personalAccessKeyFlow(env, result.sandboxHubId, result.name);
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logErrorInstance(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('name', {
    describe: i18n(`${i18nKey}.options.name.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 sandbox create --name=MySandboxAccount',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
