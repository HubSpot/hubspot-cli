import { createFunction } from '@hubspot/local-dev-lib/cms/functions';
import { createFunctionPrompt } from '../../lib/prompts/createFunctionPrompt.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { CreatableCmsAsset } from '../../types/Cms.js';

const functionAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name }) => name,
  execute: async ({ dest, commandArgs }) => {
    const functionDefinition = await createFunctionPrompt(commandArgs);

    try {
      await createFunction(functionDefinition, dest);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};

export default functionAssetType;
