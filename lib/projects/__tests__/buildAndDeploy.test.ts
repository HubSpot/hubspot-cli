import { useV3Api } from '../buildAndDeploy';

describe('buildAndDeploy', () => {
  describe('useV3Api', () => {
    it('returns true if platform version is UNSTABLE', () => {
      expect(useV3Api('UNSTABLE')).toBe(true);
    });

    it('returns true if platform version is equal to the minimum', () => {
      expect(useV3Api('2025.2')).toBe(true);
    });

    it('returns true if platform version is greater than the minimum', () => {
      expect(useV3Api('2026.2')).toBe(true);
    });

    it('returns false if platform version is less than the minimum', () => {
      expect(useV3Api('2025.0')).toBe(false);
    });

    it('returns false if platform version is invalid', () => {
      expect(useV3Api(null)).toBe(false);
    });

    it('returns false for an invalid platform version', () => {
      expect(useV3Api('notplaformversion')).toBe(false);
    });
  });
});
