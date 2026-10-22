import { createApiSamplePrompt } from '../createApiSamplePrompt.js';
import { promptUser } from '../promptUtils.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { ApiSampleConfig } from '../../../types/Cms.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');

const mockedPromptUser = vi.mocked(promptUser);

const mockSamplesConfig: ApiSampleConfig = {
  samples: [
    {
      id: 'sample-one',
      name: 'Sample One',
      description: 'The first sample',
      languages: ['node', 'python'],
    },
    {
      id: 'sample-two',
      name: 'Sample Two',
      description: 'The second sample',
      languages: ['ruby'],
    },
  ],
};

type ValidateFn = (input?: string) => Promise<boolean>;

function getValidate(callIndex: number): ValidateFn {
  const [config] = mockedPromptUser.mock.calls[callIndex];
  return (config as { validate: ValidateFn }).validate;
}

describe('lib/prompts/createApiSamplePrompt', () => {
  describe('createApiSamplePrompt()', () => {
    beforeEach(() => {
      mockedPromptUser
        .mockResolvedValueOnce({ sampleType: 'sample-one' })
        .mockResolvedValueOnce({ sampleLanguage: 'python' });
    });

    it('should return the selected sample and language', async () => {
      const result = await createApiSamplePrompt(mockSamplesConfig);

      expect(result).toEqual({
        sampleType: 'sample-one',
        sampleLanguage: 'python',
      });
    });

    it('should prompt for the sample type with every sample as a choice', async () => {
      await createApiSamplePrompt(mockSamplesConfig);

      expect(mockedPromptUser).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: 'rawlist',
          name: 'sampleType',
          message: lib.prompts.createApiSamplePrompt.selectApiSampleApp,
          choices: [
            { name: 'Sample One - The first sample', value: 'sample-one' },
            { name: 'Sample Two - The second sample', value: 'sample-two' },
          ],
        })
      );
    });

    it('should prompt for the language using the languages of the selected sample', async () => {
      await createApiSamplePrompt(mockSamplesConfig);

      expect(mockedPromptUser).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: 'rawlist',
          name: 'sampleLanguage',
          message: lib.prompts.createApiSamplePrompt.selectLanguage,
          choices: [
            { name: 'node', value: 'node' },
            { name: 'python', value: 'python' },
          ],
        })
      );
    });

    it('should return an empty object when prompting fails with an unexpected error', async () => {
      mockedPromptUser.mockReset();
      mockedPromptUser.mockRejectedValue(new Error('boom'));

      const result = await createApiSamplePrompt(mockSamplesConfig);

      expect(result).toEqual({});
    });

    it('should rethrow PromptExitErrors', async () => {
      mockedPromptUser.mockReset();
      mockedPromptUser.mockRejectedValue(
        new PromptExitError('cancelled', EXIT_CODES.SUCCESS)
      );

      await expect(createApiSamplePrompt(mockSamplesConfig)).rejects.toThrow(
        PromptExitError
      );
    });

    describe('sample type validate', () => {
      beforeEach(async () => {
        await createApiSamplePrompt(mockSamplesConfig);
      });

      it('should resolve true when a sample is selected', async () => {
        await expect(getValidate(0)('sample-one')).resolves.toBe(true);
      });

      it('should reject with the required error when no sample is selected', async () => {
        await expect(getValidate(0)('')).rejects.toBe(
          lib.prompts.createApiSamplePrompt.errors.apiSampleAppRequired
        );
      });
    });

    describe('language validate', () => {
      beforeEach(async () => {
        await createApiSamplePrompt(mockSamplesConfig);
      });

      it('should resolve true when a language is selected', async () => {
        await expect(getValidate(1)('node')).resolves.toBe(true);
      });

      it('should reject with the required error when no language is selected', async () => {
        await expect(getValidate(1)(undefined)).rejects.toBe(
          lib.prompts.createApiSamplePrompt.errors.languageRequired
        );
      });
    });
  });
});
