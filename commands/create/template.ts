import { createTemplate } from '@hubspot/local-dev-lib/cms/templates';
import { logError } from '../../lib/errorHandlers/index.js';
import { createTemplatePrompt } from '../../lib/prompts/createTemplatePrompt.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { CreatableCmsAsset } from '../../types/Cms.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const templateAssetType: CreatableCmsAsset = {
  dest: ({ dest }) => dest,
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

    try {
      await createTemplate(name, dest, templateType);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};

export default templateAssetType;
