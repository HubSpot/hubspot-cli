import { addFlag } from '../command.js';

vi.mock('child_process');
vi.mock('util');

describe('mcp-server/utils/command', () => {
  describe('addFlag', () => {
    it('should add string flag to command', () => {
      const result = addFlag('hs project create', 'name', 'test-project');
      expect(result).toBe('hs project create --name "test-project"');
    });

    it('should add number flag to command', () => {
      const result = addFlag('hs project deploy', 'build', 123);
      expect(result).toBe('hs project deploy --build "123"');
    });

    it('should add boolean flag to command', () => {
      const result = addFlag('hs project upload', 'watch', true);
      expect(result).toBe('hs project upload --watch "true"');
    });

    it('should add array flag to command', () => {
      const result = addFlag('hs project create', 'features', [
        'card',
        'settings',
      ]);
      expect(result).toBe('hs project create --features "card" "settings"');
    });

    it('should handle empty array', () => {
      const result = addFlag('hs project create', 'features', []);
      expect(result).toBe('hs project create --features ');
    });

    it('should handle array with one item', () => {
      const result = addFlag('hs project create', 'features', ['card']);
      expect(result).toBe('hs project create --features "card"');
    });

    it('should handle special characters in string values', () => {
      const result = addFlag(
        'hs project create',
        'name',
        'my-project with spaces'
      );
      expect(result).toBe('hs project create --name "my-project with spaces"');
    });

    it('should handle special characters in array values', () => {
      const result = addFlag('hs project create', 'features', [
        'card with spaces',
        'settings',
      ]);
      expect(result).toBe(
        'hs project create --features "card with spaces" "settings"'
      );
    });
  });
});
