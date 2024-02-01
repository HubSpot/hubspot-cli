const { createFunction } = require('@hubspot/local-dev-lib/cms/functions');
const {
  createFunctionPrompt,
} = require('../../lib/prompts/createFunctionPrompt');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

module.exports = {
  dest: ({ name }) => name,
  execute: async ({ dest }) => {
    const functionDefinition = await createFunctionPrompt();
    try {
      await createFunction(functionDefinition, dest);
    } catch (e) {
      logErrorInstance(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};
