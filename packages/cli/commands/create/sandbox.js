const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { loadAndValidateOptions } = require('../../lib/validation');
const { createSandbox: prompt } = require('../../lib/prompts/sandboxes');
const { getAccountId } = require('../../lib/commonOpts');

module.exports = {
  dest: ({ name }) => name,
  execute: async options => {
    loadAndValidateOptions(options);
    const accountId = getAccountId(options);
    const promptValues = await prompt();
    const sandbox = createSandbox(accountId, promptValues.name);

    return sandbox;
  },
};
