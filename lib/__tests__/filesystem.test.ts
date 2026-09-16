import path from 'path';
import { isPathInsideDirectory } from '../filesystem.js';

describe('lib/filesystem', () => {
  describe('isPathInsideDirectory', () => {
    const parentDirectory = path.join(
      '/test',
      'project',
      'src',
      'app',
      'cards'
    );

    it('should return true for the directory itself', () => {
      expect(isPathInsideDirectory(parentDirectory, parentDirectory)).toBe(
        true
      );
    });

    it('should return true for descendants', () => {
      expect(
        isPathInsideDirectory(
          path.join(parentDirectory, 'my-card'),
          parentDirectory
        )
      ).toBe(true);
      expect(
        isPathInsideDirectory(
          path.join(parentDirectory, 'my-card', 'inner'),
          parentDirectory
        )
      ).toBe(true);
    });

    it('should return true for unresolved paths that land inside', () => {
      expect(
        isPathInsideDirectory(
          path.join(parentDirectory, 'my-card', '..', 'other-card'),
          parentDirectory
        )
      ).toBe(true);
    });

    it('should return false for siblings sharing a name prefix', () => {
      expect(
        isPathInsideDirectory(`${parentDirectory}-backup`, parentDirectory)
      ).toBe(false);
      expect(
        isPathInsideDirectory(`${parentDirectory}2`, parentDirectory)
      ).toBe(false);
    });

    it('should return false for ancestors', () => {
      expect(
        isPathInsideDirectory(path.dirname(parentDirectory), parentDirectory)
      ).toBe(false);
    });

    it('should return false for unrelated paths', () => {
      expect(
        isPathInsideDirectory(
          path.join('/test', 'other', 'cards'),
          parentDirectory
        )
      ).toBe(false);
    });
  });
});
