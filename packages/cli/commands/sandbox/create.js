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
const { createSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');

exports.command = 'create [name]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { name } = options;
  const accountId = getAccountId(options);
  let namePrompt;

  trackCommandUsage('sandbox-create', {}, accountId);

  if (!name) {
    namePrompt = await createSandboxPrompt();
  }

  const sandboxName = name || namePrompt.name;

  logger.debug(`Creating sandbox '${sandboxName}'`);

  return createSandbox(accountId, sandboxName).then(
    ({ name, sandboxHubId }) => {
      logger.success(
        `Sandbox '${name}' with portalId '${sandboxHubId}' created successfully.`
      );
      logger.info(
        `Run 'hs auth' to authenticate with the new sandbox account.`
      );
    }
  );
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: 'Name to use for created sandbox',
    type: 'string',
  });

  yargs.example([
    [
      '$0 sandbox create MySandboxAccount',
      'Create a sandbox account named MySandboxAccount.',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
