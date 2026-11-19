import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { hasShownWithin, recordShown } from '../throttle.js';

vi.mock('@hubspot/local-dev-lib/config/state');

const mockedGetStateValue = vi.mocked(getStateValue);
const mockedSetStateValue = vi.mocked(setStateValue);

const NOW = new Date('2026-06-16T21:00:00.000Z');
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

describe('lib/hints/throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockedGetStateValue.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hasShownWithin()', () => {
    it('should return false when the flag has never been recorded', () => {
      expect(hasShownWithin('mcpPromotionLastShownAt', ONE_HOUR_IN_MS)).toBe(
        false
      );
    });

    it('should return true when the flag was recorded inside the window', () => {
      mockedGetStateValue.mockReturnValue('2026-06-16T20:30:00.000Z');

      expect(hasShownWithin('mcpPromotionLastShownAt', ONE_HOUR_IN_MS)).toBe(
        true
      );
    });

    it('should return false when the flag was recorded outside the window', () => {
      mockedGetStateValue.mockReturnValue('2026-06-16T19:00:00.000Z');

      expect(hasShownWithin('mcpPromotionLastShownAt', ONE_HOUR_IN_MS)).toBe(
        false
      );
    });

    it('should return false when the stored value is not a valid date', () => {
      mockedGetStateValue.mockReturnValue('not-a-date');

      expect(hasShownWithin('mcpPromotionLastShownAt', ONE_HOUR_IN_MS)).toBe(
        false
      );
    });

    it('should read the flag that was passed in', () => {
      hasShownWithin('cliVersionDeprecationWarningLastShownAt', ONE_HOUR_IN_MS);

      expect(mockedGetStateValue).toHaveBeenCalledWith(
        'cliVersionDeprecationWarningLastShownAt'
      );
    });
  });

  describe('recordShown()', () => {
    it('should write the current time to the flag', () => {
      recordShown('mcpPromotionLastShownAt');

      expect(mockedSetStateValue).toHaveBeenCalledWith(
        'mcpPromotionLastShownAt',
        NOW.toISOString()
      );
    });
  });
});
