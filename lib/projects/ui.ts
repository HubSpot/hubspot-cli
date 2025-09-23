import { uiLogger } from '../ui/logger.js';
import { FEEDBACK_INTERVAL } from '../constants.js';
import { uiLine } from '../ui/index.js';
import { lib } from '../../lang/en.js';

export function logFeedbackMessage(buildId: number): void {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    uiLogger.log(lib.projects.logFeedbackMessage.feedbackHeader);
    uiLine();
    uiLogger.log(lib.projects.logFeedbackMessage.feedbackMessage);
  }
}
