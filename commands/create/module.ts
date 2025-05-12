import { createModule } from '@hubspot/local-dev-lib/cms/modules';
import { createModulePrompt } from '../../lib/prompts/createModulePrompt';
import { logError } from '../../lib/errorHandlers/index';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { CreatableCmsAsset } from '../../types/Cms';
import { uiLogger } from '../../lib/ui/logger';
import { commands } from '../../lang/en';

const moduleAssetType: CreatableCmsAsset = {
  hidden: false,
  dest: ({ dest }) => dest,
  validate: ({ name }) => {
    if (!name) {
      uiLogger.error(commands.create.subcommands.module.errors.nameRequired);
      return false;
    }
    return true;
  },
  execute: async ({ name, dest, getInternalVersion }) => {
    const moduleDefinition = await createModulePrompt();
    try {
      await createModule(moduleDefinition, name, dest, getInternalVersion);
    } catch (e) {
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }
  },
};

export default moduleAssetType;
