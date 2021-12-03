const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logger } = require('@hubspot/cli-lib/logger');

const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { createSandbox: prompt } = require('../../lib/prompts/sandboxes');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.sandbox.subcommands.create';

exports.command = 'create [name]';
exports.describe = false;

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { name } = options;
  const accountId = getAccountId(options);
  let namePrompt;

  trackCommandUsage('sandbox-create', {}, accountId);

  if (!name) {
    namePrompt = await prompt();
  }

  const sandboxName = name || namePrompt.name;

  logger.debug(
    i18n(`${i18nKey}.debug.creating`, {
      name: sandboxName,
    })
  );

  return createSandbox(accountId, sandboxName).then(
    ({ name, sandboxHubId }) => {
      logger.success(
        i18n(`${i18nKey}.describe`, {
          name,
          sandboxHubId,
        })
      );
      logger.info(i18n(`${i18nKey}.info.auth`));
    }
  );
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

  return yargs;
};
