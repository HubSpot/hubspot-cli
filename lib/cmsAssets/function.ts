import { createFunction } from '@hubspot/local-dev-lib/cms/functions';
import { createFunctionPrompt } from '../../lib/prompts/createFunctionPrompt.js';
import { CreatableCmsAsset } from '../../types/Cms.js';

const functionAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ name }) => name!,
  execute: async ({ dest, commandArgs }) => {
    const functionDefinition = await createFunctionPrompt(commandArgs);
    await createFunction(functionDefinition, dest!);
  },
};

export default functionAssetType;
