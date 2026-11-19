import fs from 'fs';
import { resolveCommand } from '../resolveCommand.js';

const statSyncSpy = vi.spyOn(fs, 'statSync');

const mockEnv = { PATH: 'C:\\Windows;C:\\npm' };

function mockExistingFiles(files: string[]): void {
  const existingFiles = new Set(files.map(file => file.toLowerCase()));

  statSyncSpy.mockImplementation(filePath => {
    if (!existingFiles.has(String(filePath).toLowerCase())) {
      throw new Error('ENOENT');
    }
    return { isFile: () => true } as unknown as ReturnType<typeof fs.statSync>;
  });
}

describe('lib/crossPlatformSpawn/resolveCommand', () => {
  beforeEach(() => {
    vi.stubEnv('PATHEXT', '.EXE;.CMD');
    mockExistingFiles([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('resolveCommand()', () => {
    it('should find a command in a PATH directory using PATHEXT', () => {
      mockExistingFiles(['C:\\npm\\hs.cmd']);

      expect(resolveCommand('hs', mockEnv)).toBe('C:\\npm\\hs.CMD');
    });

    it('should return the first PATH directory that has a match', () => {
      mockExistingFiles(['C:\\Windows\\hs.cmd', 'C:\\npm\\hs.cmd']);

      expect(resolveCommand('hs', mockEnv)).toBe('C:\\Windows\\hs.CMD');
    });

    it('should unquote quoted PATH entries', () => {
      mockExistingFiles(['C:\\Program Files\\nodejs\\npx.cmd']);

      expect(
        resolveCommand('npx', { PATH: '"C:\\Program Files\\nodejs"' })
      ).toBe('C:\\Program Files\\nodejs\\npx.CMD');
    });

    it('should read PATH from the environment regardless of key casing', () => {
      mockExistingFiles(['C:\\npm\\hs.cmd']);

      expect(resolveCommand('hs', { Path: 'C:\\npm' })).toBe('C:\\npm\\hs.CMD');
    });

    it('should ignore files whose extension is not listed in PATHEXT', () => {
      mockExistingFiles(['C:\\npm\\hs.txt', 'C:\\npm\\hs']);

      expect(resolveCommand('hs', mockEnv)).toBeUndefined();
    });

    it('should return undefined when the command cannot be found', () => {
      expect(resolveCommand('missing', mockEnv)).toBeUndefined();
    });
  });
});
