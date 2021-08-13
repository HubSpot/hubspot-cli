const { createSandbox } = require('@hubspot/cli-lib/sandboxes');
const { createSandbox: prompt } = require('../../lib/prompts/sandboxes');

module.exports = {
  dest: ({ name }) => name,
  execute: async ({ name }) => {
    const sandbox = createSandbox(await prompt(), name);
    console.log('sandbox: ', sandbox);
    return sandbox;
  },
};
