const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { loadAndValidateOptions } = require('../../lib/validation');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { ENVIRONMENTS } = require('@hubspot/cli-lib/lib/constants');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { getAccountConfig, getConfig } = require('@hubspot/cli-lib');
const { buildSandbox } = require('../../lib/sandbox-create');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  setAsDefaultAccountPrompt,
} = require('../../lib/prompts/setAsDefaultAccountPrompt');
const { uiFeatureHighlight } = require('../../lib/ui');
const { sandboxTypeMap } = require('../../lib/sandboxes');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

exports.command = 'create [--name]';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name, type } = options;
  const accountId = getAccountId(options);
  const accountConfig = getAccountConfig(accountId);
  const env = options.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD;

  try {
    const { result, sandboxConfigName } = await buildSandbox({
      name,
      type,
      accountConfig,
      env,
    });

    const setAsDefault = await setAsDefaultAccountPrompt(sandboxConfigName);

    logger.log('');
    if (setAsDefault) {
      logger.success(
        i18n(`cli.lib.prompts.setAsDefaultAccountPrompt.setAsDefaultAccount`, {
          accountName: sandboxConfigName,
        })
      );
    } else {
      const config = getConfig();
      logger.info(
        i18n(
          `cli.lib.prompts.setAsDefaultAccountPrompt.keepingCurrentDefault`,
          {
            accountName: config.defaultPortal,
          }
        )
      );
    }
    const sandboxType = sandboxTypeMap[result.sandbox.type];
    uiFeatureHighlight([
      'projectDevCommand',
      sandboxType === 'development'
        ? 'sandboxSyncDevelopmentCommand'
        : 'sandboxSyncStandardCommand',
    ]);
  } catch (error) {
    // Errors are logged in buildSandbox
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('name', {
    describe: i18n(`${i18nKey}.options.name.describe`),
    type: 'string',
  });
  yargs.option('type', {
    describe: i18n(`${i18nKey}.options.type.describe`),
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
