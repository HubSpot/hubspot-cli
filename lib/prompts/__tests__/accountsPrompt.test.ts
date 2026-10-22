import {
  getAllConfigAccounts,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  AUTHENTICATE_NEW_ACCOUNT_VALUE,
  selectAccountFromConfig,
} from '../accountsPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiAccountDescription } from '../../ui/index.js';
import { commands } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui/index');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedGetConfigDefaultAccountIfExists = vi.mocked(
  getConfigDefaultAccountIfExists
);
const mockedUiAccountDescription = vi.mocked(uiAccountDescription);

const mockAccounts = [
  { accountId: 111 },
  { accountId: 222 },
] as unknown as HubSpotConfigAccount[];

describe('lib/prompts/accountsPrompt', () => {
  describe('selectAccountFromConfig()', () => {
    beforeEach(() => {
      mockedPromptUser.mockResolvedValue({ default: 222 });
      mockedGetAllConfigAccounts.mockReturnValue(mockAccounts);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(mockAccounts[0]);
      mockedUiAccountDescription.mockImplementation(
        accountId => `account ${accountId}`
      );
    });

    it('should return the selected account id', async () => {
      const result = await selectAccountFromConfig();

      expect(result).toBe(222);
    });

    it('should map the config accounts to choices', async () => {
      await selectAccountFromConfig();

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'default',
          choices: [
            { name: 'account 111', value: 111 },
            { name: 'account 222', value: 222 },
          ],
        }),
      ]);
    });

    it('should default to the default account', async () => {
      await selectAccountFromConfig();

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ default: 111 }),
      ]);
    });

    it('should not set a default when there is no default account', async () => {
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

      await selectAccountFromConfig();

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ default: undefined }),
      ]);
    });

    it('should use the default message when no prompt is provided', async () => {
      await selectAccountFromConfig();

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          message: commands.account.subcommands.use.promptMessage,
        }),
      ]);
    });

    it('should use the provided prompt message', async () => {
      await selectAccountFromConfig('Pick an account');

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ message: 'Pick an account' }),
      ]);
    });

    it('should add the authenticate new account choice when includeAuthOption is true', async () => {
      await selectAccountFromConfig('', true);

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          choices: [
            { name: 'account 111', value: 111 },
            { name: 'account 222', value: 222 },
            {
              name: commands.account.subcommands.use.authenticateNewAccount,
              value: AUTHENTICATE_NEW_ACCOUNT_VALUE,
            },
          ],
        }),
      ]);
    });

    it('should not add the authenticate new account choice by default', async () => {
      await selectAccountFromConfig();

      expect(mockedPromptUser).not.toHaveBeenCalledWith([
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({ value: AUTHENTICATE_NEW_ACCOUNT_VALUE }),
          ]),
        }),
      ]);
    });
  });
});
