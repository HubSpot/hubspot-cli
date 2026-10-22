import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { confirmImportDataPrompt } from '../confirmImportDataPrompt.js';
import { promptUser } from '../promptUtils.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/config');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetConfigAccountById = vi.mocked(getConfigAccountById);

const mockAccount = { accountId: 123 } as unknown as HubSpotConfigAccount;
const mockFileNames = ['contacts.json', 'companies.json'];

describe('lib/prompts/confirmImportDataPrompt', () => {
  describe('confirmImportDataPrompt()', () => {
    beforeEach(() => {
      mockedGetConfigAccountById.mockReturnValue(mockAccount);
      mockedPromptUser.mockResolvedValue({ confirmImportData: true });
    });

    it('should return true when the user confirms', async () => {
      const result = await confirmImportDataPrompt(123, mockFileNames);

      expect(result).toBe(true);
    });

    it('should return false when the user declines', async () => {
      mockedPromptUser.mockResolvedValue({ confirmImportData: false });

      const result = await confirmImportDataPrompt(123, mockFileNames);

      expect(result).toBe(false);
    });

    it('should look up the target account in the config', async () => {
      await confirmImportDataPrompt(123, mockFileNames);

      expect(mockedGetConfigAccountById).toHaveBeenCalledWith(123);
    });

    it('should prompt with a confirm message that includes the file names and account', async () => {
      await confirmImportDataPrompt(123, mockFileNames);

      expect(mockedPromptUser).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirmImportData',
        message: lib.prompts.confirmImportDataPrompt.message(
          mockFileNames,
          mockAccount
        ),
      });
    });
  });
});
