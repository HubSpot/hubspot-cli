import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import {
  cliAccountNamePrompt,
  getCliAccountNamePromptConfig,
  hubspotAccountNamePrompt,
} from '../accountNamePrompt.js';
import { promptUser } from '../promptUtils.js';
import { lib } from '../../../lang/en.js';

vi.mock('../promptUtils');
vi.mock('@hubspot/local-dev-lib/config');

const mockedPromptUser = vi.mocked(promptUser);
const mockedGetConfigAccountIfExists = vi.mocked(getConfigAccountIfExists);

const mockAccountResponse = { name: 'my-account' };
const mockExistingAccount = {
  accountId: 123,
} as unknown as HubSpotConfigAccount;

type ValidateFn = (value?: unknown) => unknown;

function getValidate(): ValidateFn {
  const [config] = mockedPromptUser.mock.calls[0];
  const [prompt] = Array.isArray(config) ? config : [config];
  return prompt.validate as ValidateFn;
}

describe('lib/prompts/accountNamePrompt', () => {
  beforeEach(() => {
    mockedPromptUser.mockResolvedValue(mockAccountResponse);
    mockedGetConfigAccountIfExists.mockReturnValue(undefined);
  });

  describe('getCliAccountNamePromptConfig()', () => {
    it('should return a config with the account name message and default', () => {
      const config = getCliAccountNamePromptConfig('default-name');

      expect(config).toEqual(
        expect.objectContaining({
          name: 'name',
          message: lib.prompts.accountNamePrompt.enterAccountName,
          default: 'default-name',
        })
      );
    });

    describe('validate', () => {
      const validate = getCliAccountNamePromptConfig().validate as ValidateFn;

      it('should return the invalid name error when the value is not a string', () => {
        expect(validate(undefined)).toBe(
          lib.prompts.accountNamePrompt.errors.invalidName
        );
      });

      it('should return the name required error when the value is empty', () => {
        expect(validate('')).toBe(
          lib.prompts.accountNamePrompt.errors.nameRequired
        );
      });

      it('should return the spaces error when the value contains spaces', () => {
        expect(validate('my account')).toBe(
          lib.prompts.accountNamePrompt.errors.spacesInName
        );
      });

      it('should return the name exists error when an account with the name exists', () => {
        mockedGetConfigAccountIfExists.mockReturnValue(mockExistingAccount);

        expect(validate('taken')).toBe(
          lib.prompts.accountNamePrompt.errors.accountNameExists('taken')
        );
      });

      it('should return true when the name is valid and unused', () => {
        expect(validate('available')).toBe(true);
      });
    });
  });

  describe('cliAccountNamePrompt()', () => {
    it('should prompt with the cli account name config', async () => {
      const result = await cliAccountNamePrompt('default-name');

      expect(result).toEqual(mockAccountResponse);
      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'name',
          message: lib.prompts.accountNamePrompt.enterAccountName,
          default: 'default-name',
        })
      );
    });
  });

  describe('hubspotAccountNamePrompt()', () => {
    it('should return the prompt response', async () => {
      const result = await hubspotAccountNamePrompt({
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
      });

      expect(result).toEqual(mockAccountResponse);
    });

    it('should use the standard sandbox message for standard sandboxes', async () => {
      await hubspotAccountNamePrompt({
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
      });

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          message: lib.prompts.accountNamePrompt.enterStandardSandboxName,
          default: undefined,
        }),
      ]);
    });

    it('should use the development sandbox message for development sandboxes', async () => {
      await hubspotAccountNamePrompt({
        accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
      });

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          message: lib.prompts.accountNamePrompt.enterDevelopmentSandboxName,
          default: undefined,
        }),
      ]);
    });

    it('should use the developer test account message and a numbered default name for developer test accounts', async () => {
      await hubspotAccountNamePrompt({
        accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
        currentPortalCount: 2,
      });

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          message: lib.prompts.accountNamePrompt.enterDeveloperTestAccountName,
          default:
            lib.prompts.accountNamePrompt.developerTestAccountDefaultName(3),
        }),
      ]);
    });

    it('should default the portal count to zero', async () => {
      await hubspotAccountNamePrompt({
        accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
      });

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({
          default:
            lib.prompts.accountNamePrompt.developerTestAccountDefaultName(1),
        }),
      ]);
    });

    it('should not set a message or default for other account types', async () => {
      await hubspotAccountNamePrompt({
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
      });

      expect(mockedPromptUser).toHaveBeenCalledWith([
        expect.objectContaining({ message: undefined, default: undefined }),
      ]);
    });

    describe('validate', () => {
      beforeEach(async () => {
        await hubspotAccountNamePrompt({
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
        });
      });

      it('should return the invalid name error when the value is not a string', () => {
        expect(getValidate()(undefined)).toBe(
          lib.prompts.accountNamePrompt.errors.invalidName
        );
      });

      it('should return the name required error when the value is blank', () => {
        expect(getValidate()('   ')).toBe(
          lib.prompts.accountNamePrompt.errors.nameRequired
        );
      });

      it('should return the name exists error when an account with the name exists', () => {
        mockedGetConfigAccountIfExists.mockReturnValue(mockExistingAccount);

        expect(getValidate()('taken')).toBe(
          lib.prompts.accountNamePrompt.errors.accountNameExists('taken')
        );
      });

      it('should allow spaces in the name', () => {
        expect(getValidate()('my sandbox')).toBe(true);
      });
    });
  });
});
