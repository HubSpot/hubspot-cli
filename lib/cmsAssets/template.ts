import { createTemplate } from '@hubspot/local-dev-lib/cms/templates';
import { createTemplatePrompt } from '../../lib/prompts/createTemplatePrompt.js';
import { CreatableCmsAsset } from '../../types/Cms.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const templateAssetType: CreatableCmsAsset = {
  dest: ({ dest }) => dest!,
  hidden: false,
  validate: ({ name }) => {
    if (!name) {
      uiLogger.error(commands.create.subcommands.template.errors.nameRequired);
      return false;
    }

    return true;
  },
  execute: async ({ name, dest, commandArgs }) => {
    const { templateType } = await createTemplatePrompt(commandArgs);
    await createTemplate(name!, dest!, templateType);
  },
};

export default templateAssetType;
