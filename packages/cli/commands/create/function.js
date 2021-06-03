const { createFunction } = require('@hubspot/cli-lib/functions');
const { createFunctionPrompt } = require('../../lib/createFunctionPrompt');

module.exports = {
  dest: ({ name }) => name,
  execute: async ({ dest }) => {
    const functionDefinition = await createFunctionPrompt();
    createFunction(functionDefinition, dest);
  },
};
