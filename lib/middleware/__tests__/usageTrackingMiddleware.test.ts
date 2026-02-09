import { Arguments } from 'yargs';
import {
  handleDisableUsageTracking,
  isUsageTrackingDisableFlagSet,
} from '../usageTrackingMiddleware.js';

describe('lib/middleware/usageTrackingMiddleware', () => {
  beforeEach(() => {
    delete process.env.DISABLE_USAGE_TRACKING;
  });

  afterEach(() => {
    delete process.env.DISABLE_USAGE_TRACKING;
  });

  describe('handleDisableUsageTracking()', () => {
    it('should set environment variable when flag is true', () => {
      const argv = { disableUsageTracking: true } as Arguments<{
        disableUsageTracking: boolean;
      }>;

      handleDisableUsageTracking(argv);

      expect(process.env.DISABLE_USAGE_TRACKING).toBe('true');
    });

    it('should not set environment variable when flag is false', () => {
      const argv = { disableUsageTracking: false } as Arguments<{
        disableUsageTracking: boolean;
      }>;

      handleDisableUsageTracking(argv);

      expect(process.env.DISABLE_USAGE_TRACKING).toBeUndefined();
    });

    it('should not set environment variable when flag is undefined', () => {
      const argv = {} as Arguments<{ disableUsageTracking?: boolean }>;

      handleDisableUsageTracking(argv);

      expect(process.env.DISABLE_USAGE_TRACKING).toBeUndefined();
    });
  });

  describe('isUsageTrackingDisableFlagSet()', () => {
    it('should return true when environment variable is set to "true"', () => {
      process.env.DISABLE_USAGE_TRACKING = 'true';

      expect(isUsageTrackingDisableFlagSet()).toBe(true);
    });

    it('should return false when environment variable is not set', () => {
      delete process.env.DISABLE_USAGE_TRACKING;

      expect(isUsageTrackingDisableFlagSet()).toBe(false);
    });

    it('should return false when environment variable is set to other values', () => {
      process.env.DISABLE_USAGE_TRACKING = 'false';

      expect(isUsageTrackingDisableFlagSet()).toBe(false);
    });

    it('should return false when environment variable is empty string', () => {
      process.env.DISABLE_USAGE_TRACKING = '';

      expect(isUsageTrackingDisableFlagSet()).toBe(false);
    });
  });
});
