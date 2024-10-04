const { createFunction } = require('@hubspot/local-dev-lib/cms/functions');
const {
  createFunctionPrompt,
} = require('../../lib/prompts/createFunctionPrompt');
const { logError } = require('../../lib/errorHandlers/index');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

module.exports = {
  dest: ({ name }) => name,
  execute: async ({ dest }) => {
    const functionDefinition = await createFunctionPrompt();
    try {
      await createFunction(functionDefinition, dest);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};
