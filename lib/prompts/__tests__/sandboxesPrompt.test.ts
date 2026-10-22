import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import {
  getAllConfigAccounts,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { deleteSandboxPrompt, sandboxTypePrompt } from '../sandboxesPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiAccountDescription } from '../../ui/index.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../ui/index');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedGetConfigDefaultAccountIfExists = vi.mocked(
  getConfigDefaultAccountIfExists
);
const mockedUiAccountDescription = vi.mocked(uiAccountDescription);

const mockStandardAccount = {
  name: 'prod',
  accountId: 100,
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
} as unknown as HubSpotConfigAccount;
const mockDevSandbox = {
  name: 'dev-sandbox',
  accountId: 200,
  accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
} as unknown as HubSpotConfigAccount;
const mockStandardSandbox = {
  name: 'std-sandbox',
  accountId: 300,
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
} as unknown as HubSpotConfigAccount;

describe('lib/prompts/sandboxesPrompt', () => {
  describe('sandboxTypePrompt()', () => {
    it('should prompt for the sandbox type defaulting to a development sandbox', async () => {
      mockedPromptUser.mockResolvedValue({
        type: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
      });

      const result = await sandboxTypePrompt();

      expect(result).toEqual({ type: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX });
      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          name: 'type',
          message: lib.prompts.sandboxesPrompt.type.message,
          type: 'list',
          choices: [
            {
              name: lib.prompts.sandboxesPrompt.type.developer,
              value: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
            },
            {
              name: lib.prompts.sandboxesPrompt.type.standard,
              value: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
            },
          ],
          default: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        },
      ]);
    });
  });

  describe('deleteSandboxPrompt()', () => {
    beforeEach(() => {
      mockedGetAllConfigAccounts.mockReturnValue([
        mockStandardAccount,
        mockDevSandbox,
        mockStandardSandbox,
      ]);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(mockDevSandbox);
      mockedUiAccountDescription.mockImplementation(
        accountId => `account ${accountId}`
      );
      mockedPromptUser.mockResolvedValue({ account: '200' });
    });

    it('should return the prompt response', async () => {
      const result = await deleteSandboxPrompt();

      expect(result).toEqual({ account: '200' });
    });

    it('should only offer sandbox accounts by default', async () => {
      await deleteSandboxPrompt();

      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          name: 'account',
          message: lib.prompts.sandboxesPrompt.selectAccountName,
          type: 'list',
          pageSize: 20,
          choices: [
            { name: 'account 200', value: 200 },
            { name: 'account 300', value: 300 },
          ],
          default: 200,
        },
      ]);
    });

    it('should only offer non-sandbox accounts when prompting for the parent account', async () => {
      await deleteSandboxPrompt(true);

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          message: lib.prompts.sandboxesPrompt.selectParentAccountName,
          choices: [{ name: 'prod (100)', value: 100 }],
        }),
      ]);
    });

    it('should resolve undefined without prompting when there are no matching sandbox accounts', async () => {
      mockedGetAllConfigAccounts.mockReturnValue([mockStandardAccount]);

      const result = await deleteSandboxPrompt();

      expect(result).toBeUndefined();
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });

    it('should resolve undefined without prompting when there are no matching parent accounts', async () => {
      mockedGetAllConfigAccounts.mockReturnValue([mockDevSandbox]);

      const result = await deleteSandboxPrompt(true);

      expect(result).toBeUndefined();
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });

    it('should not set a default when there is no default account', async () => {
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

      await deleteSandboxPrompt();

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ default: undefined }),
      ]);
    });
  });
});
