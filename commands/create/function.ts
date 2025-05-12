import { createFunction } from '@hubspot/local-dev-lib/cms/functions';
import { createFunctionPrompt } from '../../lib/prompts/createFunctionPrompt';
import { logError } from '../../lib/errorHandlers/index';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { CreatableCmsAsset } from '../../types/Cms';

const functionAssetType: CreatableCmsAsset = {
  hidden: false,
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

export default functionAssetType;
