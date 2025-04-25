import { logger } from '@hubspot/local-dev-lib/logger';
import { FEEDBACK_INTERVAL } from '../constants';
import { uiLine } from '../ui';
import { lib } from '../../lang/en';

export function logFeedbackMessage(buildId: number): void {
  if (buildId > 0 && buildId % FEEDBACK_INTERVAL === 0) {
    uiLine();
    logger.log(lib.projects.logFeedbackMessage.feedbackHeader);
    uiLine();
    logger.log(lib.projects.logFeedbackMessage.feedbackMessage);
  }
}
