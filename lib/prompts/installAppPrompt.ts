import open from 'open';
import { promptUser } from './promptUtils';
import { EXIT_CODES } from '../enums/exitCodes';
import { lib } from '../../lang/en';
import { uiLogger } from '../ui/logger';

export async function installAppPrompt(
  installUrl: string,
  isReinstall = false
): Promise<void> {
  uiLogger.log('');
  if (isReinstall) {
    uiLogger.log(lib.prompts.installAppPrompt.reinstallExplanation);
  } else {
    uiLogger.log(lib.prompts.installAppPrompt.explanation);
  }

  const { shouldOpenBrowser } = await promptUser<{
    shouldOpenBrowser: boolean;
  }>({
    name: 'shouldOpenBrowser',
    type: 'confirm',
    message: isReinstall
      ? lib.prompts.installAppPrompt.reinstallPrompt
      : lib.prompts.installAppPrompt.prompt,
  });

  if (!isReinstall && !shouldOpenBrowser) {
    uiLogger.log(lib.prompts.installAppPrompt.decline);
    process.exit(EXIT_CODES.SUCCESS);
  } else if (!shouldOpenBrowser) {
    return;
  }

  open(installUrl);
}
