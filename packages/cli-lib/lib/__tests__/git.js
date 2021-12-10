const { configFilenameIsIgnoredByGitignore } = require('../git');

describe('lib/git', () => {
  describe('configFilenameIsIgnoredByGitignore method', () => {
    const fs = require('fs-extra');

    it('returns false if the config file is not ignored', () => {
      const gitignoreContent = '';
      const configPath = `/Users/fakeuser/someproject/hubspot.config.yml`;
      jest.mock('findup-sync', () => jest.fn(() => configPath));

      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        return Buffer.from(gitignoreContent);
      });

      expect(
        configFilenameIsIgnoredByGitignore(
          ['/Users/fakeuser/someproject/.gitignore'],
          configPath
        )
      ).toBe(false);
    });

    it('identifies if a config file is ignored with a specific ignore statement', () => {
      const gitignoreContent = 'hubspot.config.yml';
      const configPath = `/Users/fakeuser/someproject/hubspot.config.yml`;
      jest.mock('findup-sync', () => jest.fn(() => configPath));

      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore(
          ['/Users/fakeuser/someproject/.gitignore'],
          configPath
        )
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });

    it('identifies if a config file is ignored with a wildcard statement', () => {
      const gitignoreContent = 'hubspot.config.*';
      const configPath = `/Users/fakeuser/someproject/hubspot.config.yml`;
      jest.mock('findup-sync', () => jest.fn(() => configPath));

      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore(
          ['/Users/fakeuser/someproject/.gitignore'],
          configPath
        )
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });

    it('identifies if a non-standard named config file is not ignored', () => {
      const gitignoreContent = 'hubspot.config.yml';
      const configPath =
        '/Users/fakeuser/someproject/config/my.custom.name.yml';
      jest.mock('findup-sync', () => jest.fn(() => configPath));

      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore(
          ['/Users/fakeuser/someproject/.gitignore'],
          configPath
        )
      ).toBe(false);
      readFileSyncSpy.mockReset();
    });

    it('identifies if a non-standard named config file is ignored', () => {
      const gitignoreContent = 'my.custom.name.yml';
      const configPath =
        '/Users/fakeuser/someproject/config/my.custom.name.yml';
      jest.mock('findup-sync', () => jest.fn(() => configPath));

      const readFileSyncSpy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => {
          return Buffer.from(gitignoreContent);
        });

      expect(
        configFilenameIsIgnoredByGitignore(
          ['/Users/fakeuser/someproject/.gitignore'],
          configPath
        )
      ).toBe(true);
      readFileSyncSpy.mockReset();
    });
  });
});
