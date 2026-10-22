import { validateImportRequestFile } from '@hubspot/local-dev-lib/crm';
import { importDataFilePathPrompt } from '../importDataFilePathPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/crm');

const mockedPromptUser = vi.mocked(promptUser);
const mockedValidateImportRequestFile = vi.mocked(validateImportRequestFile);

type ValidateFn = (filePath: string) => unknown;

function getValidate(): ValidateFn {
  const [config] = mockedPromptUser.mock.calls[0];
  const [prompt] = Array.isArray(config) ? config : [config];
  return prompt.validate as ValidateFn;
}

describe('lib/prompts/importDataFilePathPrompt', () => {
  describe('importDataFilePathPrompt()', () => {
    beforeEach(() => {
      mockedPromptUser.mockResolvedValue({ filePath: '/path/to/import.json' });
    });

    it('should return the file path entered by the user', async () => {
      const result = await importDataFilePathPrompt();

      expect(result).toBe('/path/to/import.json');
    });

    it('should log the prompt context before prompting', async () => {
      await importDataFilePathPrompt();

      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.importDataFilePathPrompt.promptContext
      );
    });

    it('should prompt with an input for the file path', async () => {
      await importDataFilePathPrompt();

      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          name: 'filePath',
          message: lib.prompts.importDataFilePathPrompt.promptMessage,
        })
      );
    });

    describe('validate', () => {
      it('should return true when the file is valid', async () => {
        await importDataFilePathPrompt();

        expect(getValidate()('/path/to/import.json')).toBe(true);
        expect(mockedValidateImportRequestFile).toHaveBeenCalledWith(
          '/path/to/import.json'
        );
      });

      it('should return the error message when validation throws an error with a message', async () => {
        mockedValidateImportRequestFile.mockImplementation(() => {
          throw new Error('Invalid file');
        });
        await importDataFilePathPrompt();

        expect(getValidate()('/bad.json')).toBe('Invalid file');
      });

      it('should return false when validation throws an error without a message', async () => {
        mockedValidateImportRequestFile.mockImplementation(() => {
          throw 'bad';
        });
        await importDataFilePathPrompt();

        expect(getValidate()('/bad.json')).toBe(false);
      });
    });
  });
});
