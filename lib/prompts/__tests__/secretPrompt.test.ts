import {
  secretListPrompt,
  secretNamePrompt,
  secretValuePrompt,
} from '../secretPrompt.js';
import { promptUser } from '../promptUtils.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');

const mockedPromptUser = vi.mocked(promptUser);

describe('lib/prompts/secretPrompt', () => {
  describe('secretValuePrompt()', () => {
    it('should prompt for a masked password and return the response', async () => {
      mockedPromptUser.mockResolvedValue({ secretValue: 'shh' });

      const result = await secretValuePrompt();

      expect(result).toEqual({ secretValue: 'shh' });
      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          name: 'secretValue',
          type: 'password',
          mask: '*',
          message: lib.prompts.secretPrompt.enterValue,
        },
      ]);
    });
  });

  describe('secretNamePrompt()', () => {
    it('should prompt for the secret name and return the response', async () => {
      mockedPromptUser.mockResolvedValue({ secretName: 'MY_SECRET' });

      const result = await secretNamePrompt();

      expect(result).toEqual({ secretName: 'MY_SECRET' });
      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          name: 'secretName',
          type: 'input',
          message: lib.prompts.secretPrompt.enterName,
        },
      ]);
    });
  });

  describe('secretListPrompt()', () => {
    it('should prompt with the secrets as choices and return the response', async () => {
      const secrets = ['FIRST', 'SECOND'];
      mockedPromptUser.mockResolvedValue({ secretToModify: 'SECOND' });

      const result = await secretListPrompt(
        secrets,
        lib.prompts.secretPrompt.selectSecretUpdate
      );

      expect(result).toEqual({ secretToModify: 'SECOND' });
      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          name: 'secretToModify',
          type: 'list',
          choices: secrets,
          message: lib.prompts.secretPrompt.selectSecretUpdate,
        },
      ]);
    });
  });
});
