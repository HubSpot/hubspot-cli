import { hasFlag } from '../hasFlag';

const argvWithFlag = ['hs', 'command', '--test'];
const argvWithoutFlag = ['hs', 'command'];

describe('lib/hasFlag', () => {
  describe('hasFlag()', () => {
    it('should return true if the flag is present', () => {
      const flag = hasFlag('test', argvWithFlag);
      expect(flag).toBe(true);
    });

    it('should return false if argv is an empty array', () => {
      const flag = hasFlag('test', []);
      expect(flag).toBe(false);
    });

    it('should return false if the flag is not present', () => {
      const flag = hasFlag('test', argvWithoutFlag);
      expect(flag).toBe(false);
    });
  });
});
