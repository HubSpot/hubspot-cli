import { createTemplate } from '@hubspot/local-dev-lib/cms/templates';
import { logError } from '../../lib/errorHandlers/index';
import { createTemplatePrompt } from '../../lib/prompts/createTemplatePrompt';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { CreatableCmsAsset } from '../../types/Cms';
import { uiLogger } from '../../lib/ui/logger';
import { commands } from '../../lang/en';

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
  execute: async ({ name, dest }) => {
    const { templateType } = await createTemplatePrompt();
    try {
      await createTemplate(name, dest, templateType);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};

export default templateAssetType;
