import { uiLogger } from '../ui/logger.js';
import { FEEDBACK_INTERVAL } from '../constants.js';
import { uiLine } from '../ui/index.js';
import { lib } from '../../lang/en.js';
import { confirmPrompt } from '../prompts/promptUtils.js';

export function logFeedbackMessage(buildId: number): void {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    uiLogger.log(lib.projects.logFeedbackMessage.feedbackHeader);
    uiLine();
    uiLogger.log(lib.projects.logFeedbackMessage.feedbackMessage);
  }
}

export async function warnAboutSkippedHsMetaFiles(
  skippedHsMetaFiles: string[],
  force: boolean,
  isUpload = true
): Promise<boolean> {
  if (skippedHsMetaFiles.length === 0) return true;

  const message = isUpload
    ? lib.projects.skippedHsMetaFiles.uploadWarning(skippedHsMetaFiles)
    : lib.projects.skippedHsMetaFiles.warning(skippedHsMetaFiles);

  uiLogger.warn(message);

  if (force) return true;

  return confirmPrompt(lib.projects.skippedHsMetaFiles.prompt, {
    defaultAnswer: false,
  });
}
