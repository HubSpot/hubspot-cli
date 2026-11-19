import { LOG_LEVEL, shouldLog } from '@hubspot/local-dev-lib/logger';
import { debugError } from '../errorHandlers/index.js';
import { uiLogger } from '../ui/logger.js';
import {
  hasShownWithin,
  recordShown,
  type LastShownStateFlag,
} from './throttle.js';

export type Hint = {
  lastShownFlag: LastShownStateFlag;
  cooldownMs: number;
  message: string;
  isApplicable?: () => boolean;
};

function isOutputSuppressed(): boolean {
  return Boolean(
    process.env.CI || !process.stderr.isTTY || !shouldLog(LOG_LEVEL.LOG)
  );
}

export function shouldShowHint({
  lastShownFlag,
  cooldownMs,
  isApplicable,
}: Hint): boolean {
  if (isOutputSuppressed()) {
    return false;
  }

  if (hasShownWithin(lastShownFlag, cooldownMs)) {
    return false;
  }

  return isApplicable ? isApplicable() : true;
}

export function showHint(hint: Hint): boolean {
  try {
    if (!shouldShowHint(hint)) {
      return false;
    }

    recordShown(hint.lastShownFlag);
    uiLogger.hint(hint.message);
    return true;
  } catch (e) {
    debugError(e);
    return false;
  }
}
