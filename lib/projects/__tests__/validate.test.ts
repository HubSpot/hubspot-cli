import { vi } from 'vitest';
import { validateProject } from '../validate.js';
import {
  validateProjectForProfile,
  getProfileAccountId,
} from '../projectProfiles.js';
import { handleTranslate, validateSourceDirectory } from '../upload.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';
import { getErrorMessage } from '../../errorHandlers/index.js';
import SpinniesManager from '../../ui/SpinniesManager.js';

vi.mock('../projectProfiles.js');
vi.mock('../upload.js');
vi.mock('@hubspot/project-parsing-lib/profiles');
vi.mock('../../errorHandlers/index.js');
vi.mock('../../ui/SpinniesManager.js');

describe('lib/projects/validate', () => {
  const projectDir = '/test/project';
  const projectConfig = {
    name: 'test-project',
    srcDir: 'src',
    platformVersion: '2025.2',
  };

  beforeEach(() => {
    vi.mocked(getAllHsProfiles).mockResolvedValue([]);
    vi.mocked(validateProjectForProfile).mockResolvedValue([]);
    // Default: no readable account context unless a test opts in.
    vi.mocked(getProfileAccountId).mockReturnValue(undefined);
    vi.mocked(validateSourceDirectory).mockResolvedValue([]);
    vi.mocked(handleTranslate).mockResolvedValue({
      intermediateRepresentation: { intermediateNodesIndexedByUid: {} },
      skippedHsMetaFiles: [],
    });
    vi.mocked(getErrorMessage).mockImplementation((error: unknown) =>
      error instanceof Error ? error.message : String(error)
    );
  });

  describe('single profile', () => {
    it('returns a valid result and includes profile account context in JSON mode', async () => {
      vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod']);
      vi.mocked(validateProjectForProfile).mockResolvedValue([]);
      vi.mocked(getProfileAccountId).mockReturnValue(456);

      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        profile: 'dev',
        formatOutputAsJson: true,
      });

      expect(validateProjectForProfile).toHaveBeenCalledWith({
        projectConfig,
        projectDir,
        profileName: 'dev',
        derivedAccountId: 123,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.profiles).toEqual([
        { name: 'dev', accountId: 456, valid: true },
      ]);
    });

    it('tags profile errors and omits account context in human mode', async () => {
      vi.mocked(validateProjectForProfile).mockResolvedValue([
        'Profile is invalid',
      ]);

      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        profile: 'dev',
        formatOutputAsJson: false,
      });

      expect(validateProjectForProfile).toHaveBeenCalledWith({
        projectConfig,
        projectDir,
        profileName: 'dev',
        derivedAccountId: 123,
      });
      expect(getProfileAccountId).not.toHaveBeenCalled();
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { message: 'Profile is invalid', profile: 'dev' },
      ]);
      expect(result.profiles).toEqual([{ name: 'dev', valid: false }]);
    });
  });

  describe('all profiles', () => {
    it('validates every profile in JSON mode', async () => {
      vi.mocked(getAllHsProfiles).mockResolvedValue(['dev', 'prod']);
      vi.mocked(validateProjectForProfile)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['prod broken']);

      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        formatOutputAsJson: true,
      });

      expect(validateProjectForProfile).toHaveBeenCalledTimes(2);
      expect(validateProjectForProfile).toHaveBeenCalledWith(
        expect.objectContaining({ indentSpinners: true })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { message: 'prod broken', profile: 'prod' },
      ]);
      expect(result.profiles).toEqual([
        { name: 'dev', valid: true },
        { name: 'prod', valid: false },
      ]);
    });

    it('drives spinners in human mode', async () => {
      vi.mocked(getAllHsProfiles).mockResolvedValue(['dev']);

      await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        formatOutputAsJson: false,
      });

      expect(SpinniesManager.add).toHaveBeenCalledWith(
        'validatingAllProfiles',
        expect.any(Object)
      );
      expect(SpinniesManager.succeed).toHaveBeenCalled();
    });
  });

  describe('no profiles', () => {
    it('translates and validates the source directory', async () => {
      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        formatOutputAsJson: true,
      });

      expect(handleTranslate).toHaveBeenCalledWith({
        projectDir,
        projectConfig,
        accountId: 123,
        skipValidation: false,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('reports translation failures and skips source validation', async () => {
      vi.mocked(handleTranslate).mockRejectedValue(
        new Error('Translation failed')
      );

      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        formatOutputAsJson: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([{ message: 'Translation failed' }]);
      expect(validateSourceDirectory).not.toHaveBeenCalled();
    });
  });

  describe('source directory', () => {
    it('collects legacy-file warnings with file references', async () => {
      vi.mocked(validateSourceDirectory).mockResolvedValue([
        { message: 'Legacy config file detected', file: 'src/serverless.json' },
      ]);

      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        formatOutputAsJson: true,
      });

      expect(validateSourceDirectory).toHaveBeenCalledWith(
        expect.any(String),
        projectConfig,
        projectDir
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([
        { message: 'Legacy config file detected', file: 'src/serverless.json' },
      ]);
    });

    it('reports source directory errors', async () => {
      vi.mocked(validateSourceDirectory).mockRejectedValue(
        new Error('Source directory is empty')
      );

      const result = await validateProject({
        projectConfig,
        projectDir,
        derivedAccountId: 123,
        formatOutputAsJson: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([{ message: 'Source directory is empty' }]);
    });
  });
});
