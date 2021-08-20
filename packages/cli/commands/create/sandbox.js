const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { createSandbox: prompt } = require('../../lib/prompts/sandboxes');
const { getAccountId } = require('../../lib/commonOpts');
const { logger } = require('../../../cli-lib/logger');

module.exports = {
  dest: ({ name }) => name,
  execute: async options => {
    loadAndValidateOptions(options);
    const accountId = getAccountId(options);
    const promptValues = await prompt();
    const sandbox = createSandbox(accountId, promptValues.name);

    sandbox.then(({ name, sandboxHubId }) => {
      logger.success(
        `Sandbox "${name}" with portalId "${sandboxHubId}" created successfully.`
      );
      logger.info(
        `Run "hs auth" to authenticate with the new sandbox account.`
      );
    });

    return sandbox;
  },
};
