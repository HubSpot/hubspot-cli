import { isV2Project } from '../platformVersion.js';

describe('platformVersion', () => {
  describe('isV2Project', () => {
    it('returns true if platform version is UNSTABLE', () => {
      expect(isV2Project('UNSTABLE')).toBe(true);
    });

    it('returns true if platform version is equal to the minimum', () => {
      expect(isV2Project('2025.2')).toBe(true);
    });

    it('returns true if platform version is greater than the minimum', () => {
      expect(isV2Project('2026.2')).toBe(true);
    });

    it('returns false if platform version is less than the minimum', () => {
      expect(isV2Project('2025.0')).toBe(false);
    });

    it('returns false if platform version is invalid', () => {
      expect(isV2Project(null)).toBe(false);
    });

    it('returns false for an invalid platform version', () => {
      expect(isV2Project('notplaformversion')).toBe(false);
    });
  });
});
