import open from 'open';
import { promptUser } from './promptUtils.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

export async function installAppBrowserPrompt(
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

export async function installAppAutoPrompt(): Promise<boolean> {
  uiLogger.log('');

  const { shouldInstall } = await promptUser<{
    shouldInstall: boolean;
  }>({
    name: 'shouldInstall',
    type: 'confirm',
    message: lib.prompts.installAppPrompt.autoPrompt,
  });

  return shouldInstall;
}
