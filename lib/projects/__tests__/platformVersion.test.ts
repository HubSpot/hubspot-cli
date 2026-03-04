import {
  isV2Project,
  isUnsupportedPlatformVersion,
} from '../platformVersion.js';

describe('platformVersion', () => {
  describe('isV2Project', () => {
    it('returns true if platform version is UNSTABLE', () => {
      expect(isV2Project('UNSTABLE')).toBe(true);
    });

    it('returns true if platform version is equal to the minimum', () => {
      expect(isV2Project('2025.2')).toBe(true);
    });

    it('returns true if platform version is greater than the minimum', () => {
      expect(isV2Project('2025.3')).toBe(true);
      expect(isV2Project('2026.03')).toBe(true);
      expect(isV2Project('2026.03-beta')).toBe(true);
    });

    it('returns false if platform version is less than the minimum', () => {
      expect(isV2Project('2025.0')).toBe(false);
      expect(isV2Project('2025.01')).toBe(false);
      expect(isV2Project('2025.01-beta')).toBe(false);
    });

    it('returns false if platform version is invalid', () => {
      expect(isV2Project(null)).toBe(false);
    });

    it('returns false for an invalid platform version', () => {
      expect(isV2Project('notplaformversion')).toBe(false);
    });
  });

  describe('isUnsupportedPlatformVersion', () => {
    it('returns false for platform version 2026.03 (boundary)', () => {
      expect(isUnsupportedPlatformVersion('2026.03')).toBe(false);
    });

    it('returns false for platform versions less than 2026.03', () => {
      expect(isUnsupportedPlatformVersion('2025.2')).toBe(false);
      expect(isUnsupportedPlatformVersion('2026.01')).toBe(false);
      expect(isUnsupportedPlatformVersion('2026.02')).toBe(false);
    });

    it('returns true for platform version 2026.04', () => {
      expect(isUnsupportedPlatformVersion('2026.04')).toBe(true);
    });

    it('returns true for platform versions greater than 2026.03', () => {
      expect(isUnsupportedPlatformVersion('2026.4')).toBe(true);
      expect(isUnsupportedPlatformVersion('2027.01')).toBe(true);
      expect(isUnsupportedPlatformVersion('2027.1')).toBe(true);
      expect(isUnsupportedPlatformVersion('2028.10')).toBe(true);
    });

    it('returns false for UNSTABLE', () => {
      expect(isUnsupportedPlatformVersion('UNSTABLE')).toBe(false);
      expect(isUnsupportedPlatformVersion('unstable')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isUnsupportedPlatformVersion(null)).toBe(false);
      expect(isUnsupportedPlatformVersion(undefined)).toBe(false);
    });

    it('returns false for invalid platform versions', () => {
      expect(isUnsupportedPlatformVersion('notaversion')).toBe(false);
      expect(isUnsupportedPlatformVersion('abc.def')).toBe(false);
    });

    it('handles beta versions correctly', () => {
      expect(isUnsupportedPlatformVersion('2026.03-beta')).toBe(false);
      expect(isUnsupportedPlatformVersion('2026.04-beta')).toBe(true);
      expect(isUnsupportedPlatformVersion('2027.01-beta')).toBe(true);
    });
  });
});
