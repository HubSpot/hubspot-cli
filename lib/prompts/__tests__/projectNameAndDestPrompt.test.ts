import fs from 'fs';
import path from 'path';
import {
  getCwd,
  isValidPath,
  sanitizeFileName,
  untildify,
} from '@hubspot/local-dev-lib/path';
import {
  projectNameAndDestPrompt,
  validateProjectDirectory,
} from '../projectNameAndDestPrompt.js';
import { promptUser } from '../promptUtils.js';
import { PROJECT_CONFIG_FILE } from '../../constants.js';
import { lib } from '../../../lang/en.js';

vi.mock('fs');
vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/path');

const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedPromptUser = vi.mocked(promptUser);
const mockedGetCwd = vi.mocked(getCwd);
const mockedIsValidPath = vi.mocked(isValidPath);
const mockedSanitizeFileName = vi.mocked(sanitizeFileName);
const mockedUntildify = vi.mocked(untildify);

const CWD = '/home/user';

type PromptConfigs = Exclude<
  Parameters<typeof promptUser>[0],
  { name: unknown }
>;
type ValidateFn = (input?: string) => unknown;
type DefaultFn = (answers: { name?: string }) => string;
type FilterFn = (input: string) => string;

function getPromptConfigs(): PromptConfigs {
  return mockedPromptUser.mock.calls[0][0] as PromptConfigs;
}

describe('lib/prompts/projectNameAndDestPrompt', () => {
  beforeEach(() => {
    mockedGetCwd.mockReturnValue(CWD);
    mockedExistsSync.mockReturnValue(false);
    mockedIsValidPath.mockReturnValue(true);
    mockedSanitizeFileName.mockImplementation(name => name);
    mockedUntildify.mockImplementation(input => input);
  });

  describe('projectNameAndDestPrompt()', () => {
    beforeEach(() => {
      mockedPromptUser.mockResolvedValue({
        name: 'my-project',
        dest: '/home/user/my-project',
      });
    });

    it('should return the prompt response', async () => {
      const result = await projectNameAndDestPrompt({});

      expect(result).toEqual({
        name: 'my-project',
        dest: '/home/user/my-project',
      });
    });

    it('should prompt for name and dest when neither option is provided', async () => {
      await projectNameAndDestPrompt({});

      expect(getPromptConfigs()).toEqual([
        expect.objectContaining({
          name: 'name',
          message: lib.prompts.projectNameAndDestPrompt.enterName,
          when: true,
        }),
        expect.objectContaining({
          name: 'dest',
          message: lib.prompts.projectNameAndDestPrompt.enterDest,
          when: true,
        }),
      ]);
    });

    it('should skip the prompts for options that are provided', async () => {
      await projectNameAndDestPrompt({ name: 'given', dest: '/given' });

      expect(getPromptConfigs()).toEqual([
        expect.objectContaining({ name: 'name', when: false }),
        expect.objectContaining({ name: 'dest', when: false }),
      ]);
    });

    it('should fall back to the provided options when the prompt does not return them', async () => {
      mockedPromptUser.mockResolvedValue({});

      const result = await projectNameAndDestPrompt({
        name: 'given',
        dest: '/given',
      });

      expect(result).toEqual({ name: 'given', dest: '/given' });
    });

    describe('name validate', () => {
      it('should return the name required error when the name is empty', async () => {
        await projectNameAndDestPrompt({});

        const [namePrompt] = getPromptConfigs();

        expect((namePrompt.validate as ValidateFn)('')).toBe(
          lib.prompts.projectNameAndDestPrompt.errors.nameRequired
        );
      });

      it('should return true when a name is provided', async () => {
        await projectNameAndDestPrompt({});

        const [namePrompt] = getPromptConfigs();

        expect((namePrompt.validate as ValidateFn)('name')).toBe(true);
      });
    });

    describe('dest default', () => {
      it('should default to a directory in the cwd named after the answered project name', async () => {
        await projectNameAndDestPrompt({});

        const [, destPrompt] = getPromptConfigs();
        const result = (destPrompt.default as DefaultFn)({ name: 'answered' });

        expect(result).toBe(path.resolve(CWD, 'answered'));
      });

      it('should prefer the name option over the answered name', async () => {
        await projectNameAndDestPrompt({ name: 'given' });

        const [, destPrompt] = getPromptConfigs();
        const result = (destPrompt.default as DefaultFn)({ name: 'answered' });

        expect(result).toBe(path.resolve(CWD, 'given'));
        expect(mockedSanitizeFileName).toHaveBeenCalledWith('given');
      });
    });

    describe('dest filter', () => {
      it('should untildify the input', async () => {
        mockedUntildify.mockReturnValue('/home/user/expanded');
        await projectNameAndDestPrompt({});

        const [, destPrompt] = getPromptConfigs();

        expect((destPrompt.filter as FilterFn)('~/expanded')).toBe(
          '/home/user/expanded'
        );
        expect(mockedUntildify).toHaveBeenCalledWith('~/expanded');
      });
    });
  });

  describe('validateProjectDirectory()', () => {
    it('should return the dest required error when the input is empty', () => {
      expect(validateProjectDirectory('')).toBe(
        lib.prompts.projectNameAndDestPrompt.errors.destRequired
      );
    });

    it('should return the invalid dest error when a project config exists at the destination', () => {
      mockedExistsSync.mockReturnValue(true);

      expect(validateProjectDirectory('existing')).toBe(
        lib.prompts.projectNameAndDestPrompt.errors.invalidDest
      );
      expect(mockedExistsSync).toHaveBeenCalledWith(
        path.resolve(CWD, path.join('existing', PROJECT_CONFIG_FILE))
      );
    });

    it('should return the invalid characters error when the path is not valid', () => {
      mockedIsValidPath.mockReturnValue(false);

      expect(validateProjectDirectory('bad<>path')).toBe(
        lib.prompts.projectNameAndDestPrompt.errors.invalidCharacters
      );
    });

    it('should return true when the destination is valid', () => {
      expect(validateProjectDirectory('new-project')).toBe(true);
    });
  });
});
