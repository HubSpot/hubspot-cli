import { createModule } from '@hubspot/local-dev-lib/cms/modules';
import { createModulePrompt } from '../../lib/prompts/createModulePrompt.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { CreatableCmsAsset } from '../../types/Cms.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const moduleAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ dest }) => dest!,
  validate: ({ name }) => {
    if (!name) {
      uiLogger.error(commands.create.subcommands.module.errors.nameRequired);
      return false;
    }
    return true;
  },
  execute: async ({ name, dest, getInternalVersion, commandArgs }) => {
    const moduleDefinition = await createModulePrompt(commandArgs);
    try {
      await createModule(moduleDefinition, name!, dest!, getInternalVersion!);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};

export default moduleAssetType;
