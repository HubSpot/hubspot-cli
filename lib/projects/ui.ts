import { uiLogger } from '../ui/logger';
import { FEEDBACK_INTERVAL } from '../constants';
import { uiLine } from '../ui';
import { lib } from '../../lang/en';

export function logFeedbackMessage(buildId: number): void {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    uiLogger.log(lib.projects.logFeedbackMessage.feedbackHeader);
    uiLine();
    uiLogger.log(lib.projects.logFeedbackMessage.feedbackMessage);
  }
}
