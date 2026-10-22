import path from 'path';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { uploadPrompt } from '../uploadPrompt.js';
import { promptUser } from '../promptUtils.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/path');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetCwd = vi.mocked(getCwd);

type PromptConfigs = Parameters<typeof promptUser>[0];
type ValidateFn = (input?: string) => unknown;

function getPromptConfigs(): Exclude<PromptConfigs, { name: unknown }> {
  return mockedPromptUser.mock.calls[0][0] as Exclude<
    PromptConfigs,
    { name: unknown }
  >;
}

describe('lib/prompts/uploadPrompt', () => {
  describe('uploadPrompt()', () => {
    beforeEach(() => {
      mockedGetCwd.mockReturnValue('/home/user/my-theme');
      mockedPromptUser.mockResolvedValue({ src: 'src', dest: 'dest' });
    });

    it('should return the prompt response', async () => {
      const result = await uploadPrompt();

      expect(result).toEqual({ src: 'src', dest: 'dest' });
    });

    it('should prompt for src and dest', async () => {
      await uploadPrompt();

      expect(getPromptConfigs()).toEqual([
        expect.objectContaining({
          name: 'src',
          message: lib.prompts.uploadPrompt.enterSrc,
          when: true,
          default: '.',
        }),
        expect.objectContaining({
          name: 'dest',
          message: lib.prompts.uploadPrompt.enterDest,
          when: true,
          default: path.basename('/home/user/my-theme'),
        }),
      ]);
    });

    it('should not prompt for src when it is provided', async () => {
      await uploadPrompt({ src: 'given-src' });

      expect(getPromptConfigs()).toEqual([
        expect.objectContaining({ name: 'src', when: false }),
        expect.objectContaining({ name: 'dest', when: true }),
      ]);
    });

    it('should not prompt for dest when it is provided', async () => {
      await uploadPrompt({ dest: 'given-dest' });

      expect(getPromptConfigs()).toEqual([
        expect.objectContaining({ name: 'src', when: true }),
        expect.objectContaining({ name: 'dest', when: false }),
      ]);
    });

    describe('validate', () => {
      beforeEach(async () => {
        await uploadPrompt();
      });

      it('should return the src required error when src is empty', () => {
        const [srcPrompt] = getPromptConfigs();

        expect((srcPrompt.validate as ValidateFn)('')).toBe(
          lib.prompts.uploadPrompt.errors.srcRequired
        );
      });

      it('should return true when src is provided', () => {
        const [srcPrompt] = getPromptConfigs();

        expect((srcPrompt.validate as ValidateFn)('src')).toBe(true);
      });

      it('should return the dest required error when dest is empty', () => {
        const [, destPrompt] = getPromptConfigs();

        expect((destPrompt.validate as ValidateFn)('')).toBe(
          lib.prompts.uploadPrompt.errors.destRequired
        );
      });

      it('should return true when dest is provided', () => {
        const [, destPrompt] = getPromptConfigs();

        expect((destPrompt.validate as ValidateFn)('dest')).toBe(true);
      });
    });
  });
});
