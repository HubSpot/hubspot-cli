import { validateImportRequestFile } from '@hubspot/local-dev-lib/crm';

import { promptUser } from './promptUtils.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';
import { isErrorWithMessageOrReason } from '../errorHandlers/index.js';

export async function importDataFilePathPrompt(): Promise<string> {
  uiLogger.log(lib.prompts.importDataFilePathPrompt.promptContext);
  const { filePath } = await promptUser({
    type: 'input',
    name: 'filePath',
    message: lib.prompts.importDataFilePathPrompt.promptMessage,
    validate: (filePath: string) => {
      try {
        validateImportRequestFile(filePath);
        return true;
      } catch (error) {
        if (isErrorWithMessageOrReason(error) && error.message) {
          return error.message;
        }
        return false;
      }
    },
  });
  return filePath;
}
