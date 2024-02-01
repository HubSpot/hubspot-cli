const { createFunction } = require('@hubspot/local-dev-lib/cms/functions');
const {
  createFunctionPrompt,
} = require('../../lib/prompts/createFunctionPrompt');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const { buildLogCallbacks } = require('../../lib/logCallbacks');

const i18nKey = 'cli.commands.create.subcommands.function';

const createFunctionLogCallbacks = buildLogCallbacks({
  destPathAlreadyExists: `${i18nKey}.logCallbacks.destPathAlreadyExists`,
  createdDest: `${i18nKey}.logCallbacks.createdDest`,
  createdFunctionFile: `${i18nKey}.logCallbacks.createdFunctionFile`,
  createdConfigFile: `${i18nKey}.logCallbacks.createdConfigFile`,
  success: `${i18nKey}.logCallbacks.success`,
});

module.exports = {
  dest: ({ name }) => name,
  execute: async ({ dest }) => {
    const functionDefinition = await createFunctionPrompt();
    try {
      await createFunction(
        functionDefinition,
        dest,
        {},
        createFunctionLogCallbacks
      );
    } catch (e) {
      logErrorInstance(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};
