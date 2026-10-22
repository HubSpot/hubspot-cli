import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { importDataTestAccountSelectPrompt } from '../importDataTestAccountSelectPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiAccountDescription } from '../../ui/index.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui/index');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedUiAccountDescription = vi.mocked(uiAccountDescription);

const PARENT_ACCOUNT_ID = 100;

const mockAccounts = [
  { accountId: PARENT_ACCOUNT_ID },
  { accountId: 101, parentAccountId: PARENT_ACCOUNT_ID },
  { accountId: 102, parentAccountId: PARENT_ACCOUNT_ID },
  { accountId: 201, parentAccountId: 200 },
] as unknown as HubSpotConfigAccount[];

describe('lib/prompts/importDataTestAccountSelectPrompt', () => {
  describe('importDataTestAccountSelectPrompt()', () => {
    beforeEach(() => {
      mockedGetAllConfigAccounts.mockReturnValue(mockAccounts);
      mockedUiAccountDescription.mockImplementation(
        accountId => `account ${accountId}`
      );
      mockedPromptUser.mockResolvedValue({ selectedAccountId: 101 });
    });

    it('should return the selected account', async () => {
      const result = await importDataTestAccountSelectPrompt(PARENT_ACCOUNT_ID);

      expect(result).toEqual({ selectedAccountId: 101 });
    });

    it('should only offer the child accounts of the parent account', async () => {
      await importDataTestAccountSelectPrompt(PARENT_ACCOUNT_ID);

      expect(mockedPromptUser).toHaveBeenCalledWith({
        type: 'list',
        name: 'selectedAccountId',
        message: lib.prompts.importDataTestAccountSelectPrompt.message,
        choices: [
          { name: 'account 101', value: 101 },
          { name: 'account 102', value: 102 },
        ],
      });
    });

    it('should throw when there are no accounts in the config', async () => {
      mockedGetAllConfigAccounts.mockReturnValue(
        undefined as unknown as HubSpotConfigAccount[]
      );

      await expect(
        importDataTestAccountSelectPrompt(PARENT_ACCOUNT_ID)
      ).rejects.toThrow(
        lib.prompts.importDataTestAccountSelectPrompt.errors.noAccountsFound
      );
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });

    it('should throw when the parent account has no child accounts', async () => {
      await expect(importDataTestAccountSelectPrompt(999)).rejects.toThrow(
        lib.prompts.importDataTestAccountSelectPrompt.errors.noChildTestAccountsFound(
          999
        )
      );
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });
  });
});
