import open from 'open';
import { promptUser } from './promptUtils.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { lib } from '../../lang/en.js';
import { uiLogger } from '../ui/logger.js';

export async function installAppBrowserPrompt(
  installUrl: string,
  isReinstall = false,
  staticAuthInstallOptions?: {
    testingAccountId: number;
    projectAccountId: number;
    projectName: string;
    appUid: string;
  }
): Promise<void> {
  uiLogger.log('');
  if (isReinstall) {
    uiLogger.log(lib.prompts.installAppPrompt.reinstallExplanation);
  } else {
    uiLogger.log(lib.prompts.installAppPrompt.explanation);
  }

  if (staticAuthInstallOptions) {
    const { testingAccountId, projectAccountId, projectName, appUid } =
      staticAuthInstallOptions;
    uiLogger.log(
      lib.prompts.installAppPrompt.staticAuthExplanation(
        projectAccountId,
        testingAccountId,
        projectName,
        appUid
      )
    );
    uiLogger.log('');
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
