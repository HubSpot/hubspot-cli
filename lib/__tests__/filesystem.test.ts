import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import {
  isPathInsideDirectory,
  isPathFolder,
  resolveLocalPath,
} from '../filesystem.js';

vi.mock('@hubspot/local-dev-lib/path');

const mockedGetCwd = vi.mocked(getCwd);

const CWD = path.join('/test', 'cwd');

describe('lib/filesystem', () => {
  beforeEach(() => {
    mockedGetCwd.mockReturnValue(CWD);
  });

  describe('resolveLocalPath', () => {
    it('should return the cwd when no path is provided', () => {
      expect(resolveLocalPath()).toBe(CWD);
    });

    it('should return the cwd when the path is an empty string', () => {
      expect(resolveLocalPath('')).toBe(CWD);
    });

    it('should resolve a relative path against the cwd', () => {
      expect(resolveLocalPath('some/dir')).toBe(path.join(CWD, 'some', 'dir'));
    });

    it('should return an absolute path unchanged', () => {
      const absolutePath = path.join('/other', 'place');

      expect(resolveLocalPath(absolutePath)).toBe(absolutePath);
    });
  });

  describe('isPathFolder', () => {
    it('should return true for a path with no extension', () => {
      expect(isPathFolder('some/folder')).toBe(true);
    });

    it('should return true for a folder with a known folder extension', () => {
      expect(isPathFolder('some/my-module.module')).toBe(true);
    });

    it('should return false for a file with a regular extension', () => {
      expect(isPathFolder('some/file.html')).toBe(false);
    });

    it('should only look at the last path segment', () => {
      expect(isPathFolder('some/file.html/folder')).toBe(true);
    });
  });

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
