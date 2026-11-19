import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { STATE_FLAGS } from '@hubspot/local-dev-lib/constants/config';

export type LastShownStateFlag = (typeof STATE_FLAGS)[
  | 'MCP_PROMOTION_LAST_SHOWN_AT'
  | 'CLI_VERSION_DEPRECATION_WARNING_LAST_SHOWN_AT'
  | 'CLI_VERSION_END_OF_LIFE_WARNING_LAST_SHOWN_AT'];

export function hasShownWithin(
  flag: LastShownStateFlag,
  windowMs: number
): boolean {
  const lastShown = getStateValue(flag);
  const lastShownTime =
    typeof lastShown === 'string' ? Date.parse(lastShown) : NaN;

  return !Number.isNaN(lastShownTime) && Date.now() - lastShownTime < windowMs;
}

export function recordShown(flag: LastShownStateFlag): void {
  setStateValue(flag, new Date().toISOString());
}
