import { AccessToken } from '@hubspot/local-dev-lib/types/Accounts';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import {
  accountNameExistsInConfig,
  updateAccountConfig,
  writeConfig,
  getAccountId,
} from '@hubspot/local-dev-lib/config';
import { createDeveloperTestAccount } from '@hubspot/local-dev-lib/api/developerTestAccounts';
import { createSandbox } from '@hubspot/local-dev-lib/api/sandboxHubs';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { personalAccessKeyPrompt } from '../prompts/personalAccessKeyPrompt';
import { cliAccountNamePrompt } from '../prompts/accountNamePrompt';
import * as buildAccount from '../buildAccount';

jest.mock('@hubspot/local-dev-lib/personalAccessKey');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/local-dev-lib/api/developerTestAccounts');
jest.mock('@hubspot/local-dev-lib/api/sandboxHubs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../prompts/personalAccessKeyPrompt');
jest.mock('../prompts/accountNamePrompt');

const mockedPersonalAccessKeyPrompt = personalAccessKeyPrompt as jest.Mock;
const mockedGetAccessToken = getAccessToken as jest.Mock;
const mockedUpdateConfigWithAccessToken =
  updateConfigWithAccessToken as jest.Mock;
const mockedAccountNameExistsInConfig = accountNameExistsInConfig as jest.Mock;
const mockedUpdateAccountConfig = updateAccountConfig as jest.Mock;
const mockedWriteConfig = writeConfig as jest.Mock;
const mockedCliAccountNamePrompt = cliAccountNamePrompt as jest.Mock;
const mockedGetAccountId = getAccountId as jest.Mock;
const mockedCreateDeveloperTestAccount =
  createDeveloperTestAccount as jest.Mock;
const mockedCreateSandbox = createSandbox as jest.Mock;

describe('lib/buildAccount', () => {
  describe('saveAccountToConfig()', () => {
    const mockAccountConfig = {
      name: 'Test Account',
      accountId: 123456,
      accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
      env: 'prod' as Environment,
    };
    const accessToken: AccessToken = {
      portalId: 123456,
      accessToken: 'test-token',
      expiresAt: '2025-01-01',
      scopeGroups: ['test-scope'],
      enabledFeatures: { 'test-feature': 1 },
      encodedOAuthRefreshToken: 'test-refresh-token',
      hubName: 'test-hub',
      accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
    };

    beforeEach(() => {
      mockedPersonalAccessKeyPrompt.mockResolvedValue({
        personalAccessKey: 'test-key',
        env: 'prod',
      });
      mockedGetAccessToken.mockResolvedValue(accessToken);
      mockedUpdateConfigWithAccessToken.mockResolvedValue(mockAccountConfig);
      mockedAccountNameExistsInConfig.mockResolvedValue(false);
      mockedUpdateAccountConfig.mockReturnValue(undefined);
      mockedWriteConfig.mockReturnValue(undefined);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should save account with provided personal access key', async () => {
      const result = await buildAccount.saveAccountToConfig(
        mockAccountConfig.accountId,
        mockAccountConfig.name,
        mockAccountConfig.env,
        'test-key'
      );
      expect(mockedPersonalAccessKeyPrompt).not.toHaveBeenCalled();
      expect(mockedUpdateConfigWithAccessToken).toHaveBeenCalledWith(
        accessToken,
        'test-key',
        mockAccountConfig.env
      );
      expect(mockedUpdateAccountConfig).toHaveBeenCalledWith(
        expect.objectContaining(mockAccountConfig)
      );
      expect(mockedWriteConfig).toHaveBeenCalled();
      expect(result).toBe(mockAccountConfig.name);
    });

    it('should prompt for personal access key if not provided', async () => {
      const result = await buildAccount.saveAccountToConfig(
        mockAccountConfig.accountId,
        mockAccountConfig.name,
        mockAccountConfig.env
      );
      expect(mockedPersonalAccessKeyPrompt).toHaveBeenCalledWith({
        env: mockAccountConfig.env,
        account: mockAccountConfig.accountId,
      });
      expect(mockedUpdateConfigWithAccessToken).toHaveBeenCalledWith(
        accessToken,
        'test-key',
        mockAccountConfig.env
      );
      expect(mockedUpdateAccountConfig).toHaveBeenCalledWith(
        expect.objectContaining(mockAccountConfig)
      );
      expect(mockedWriteConfig).toHaveBeenCalled();
      expect(result).toBe(mockAccountConfig.name);
    });

    it('should handle duplicate account names', async () => {
      const mockAccountConfigWithNoName = {
        ...mockAccountConfig,
        name: undefined,
      };
      mockedUpdateConfigWithAccessToken.mockResolvedValue(
        mockAccountConfigWithNoName
      );
      mockedAccountNameExistsInConfig.mockResolvedValue(true);
      mockedCliAccountNamePrompt.mockResolvedValue({
        name: 'test-account-with-new-name',
      });

      const result = await buildAccount.saveAccountToConfig(
        mockAccountConfig.accountId,
        mockAccountConfig.name,
        mockAccountConfig.env,
        'test-key'
      );
      expect(mockedCliAccountNamePrompt).toHaveBeenCalled();
      expect(result).toBe('test-account-with-new-name');
    });
  });

  describe('buildDeveloperTestAccount()', () => {
    const mockParentAccountConfig = {
      name: 'Developer Test Account',
      accountId: 123456,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
      env: 'prod' as Environment,
    };
    const mockDeveloperTestAccount = {
      testPortalId: 56789,
      parentPortalId: 123456,
      accountName: 'Developer Test Account',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      status: 'active',
      id: 56789,
    };

    beforeEach(() => {
      jest
        .spyOn(buildAccount, 'saveAccountToConfig')
        .mockResolvedValue(mockParentAccountConfig.name);
      mockedGetAccountId.mockReturnValue(mockParentAccountConfig.accountId);
      mockedCreateDeveloperTestAccount.mockResolvedValue({
        data: mockDeveloperTestAccount,
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create a developer test account successfully', async () => {
      const result = await buildAccount.buildDeveloperTestAccount(
        mockDeveloperTestAccount.accountName,
        mockParentAccountConfig,
        mockParentAccountConfig.env,
        10
      );
      expect(result).toEqual(mockDeveloperTestAccount);
    });

    it('should throw error if account ID is not found', async () => {
      mockedGetAccountId.mockReturnValue(null);
      await expect(
        buildAccount.buildDeveloperTestAccount(
          mockDeveloperTestAccount.accountName,
          mockParentAccountConfig,
          mockParentAccountConfig.env,
          10
        )
      ).rejects.toThrow();
    });

    it('should handle API errors when creating developer test account', async () => {
      mockedCreateDeveloperTestAccount.mockRejectedValue(
        new Error('test-error')
      );
      await expect(
        buildAccount.buildDeveloperTestAccount(
          mockDeveloperTestAccount.accountName,
          mockParentAccountConfig,
          mockParentAccountConfig.env,
          10
        )
      ).rejects.toThrow();
    });
  });

  describe('buildSandbox()', () => {
    const mockParentAccountConfig = {
      name: 'Developer Test Account',
      accountId: 123456,
      accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
      env: 'prod' as Environment,
    };
    const mockSandbox = {
      sandboxHubId: 56789,
      parentHubId: 123456,
      createdAt: '2025-01-01',
      type: 'sandbox',
      archived: false,
      name: 'Test Sandbox',
      domain: 'test-sandbox.hubspot.com',
      createdByUser: {
        id: 123456,
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
      },
    };

    beforeEach(() => {
      jest
        .spyOn(buildAccount, 'saveAccountToConfig')
        .mockResolvedValue(mockParentAccountConfig.name);
      mockedGetAccountId.mockReturnValue(mockParentAccountConfig.accountId);
      mockedCreateSandbox.mockResolvedValue({
        data: { sandbox: mockSandbox, personalAccessKey: 'test-key' },
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create a standard sandbox successfully', async () => {
      const result = await buildAccount.buildSandbox(
        mockSandbox.name,
        mockParentAccountConfig,
        HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
        mockParentAccountConfig.env,
        false
      );
      expect(result).toEqual({
        name: mockSandbox.name,
        personalAccessKey: 'test-key',
        sandbox: mockSandbox,
      });
    });

    it('should create a development sandbox successfully', async () => {
      const result = await buildAccount.buildSandbox(
        mockSandbox.name,
        mockParentAccountConfig,
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        mockParentAccountConfig.env
      );
      expect(result).toEqual({
        name: mockSandbox.name,
        personalAccessKey: 'test-key',
        sandbox: mockSandbox,
      });
    });

    it('should throw error if account ID is not found', async () => {
      mockedGetAccountId.mockReturnValue(null);
      await expect(
        buildAccount.buildSandbox(
          mockSandbox.name,
          mockParentAccountConfig,
          HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
          mockParentAccountConfig.env
        )
      ).rejects.toThrow();
    });

    it('should handle API errors when creating sandbox', async () => {
      mockedCreateSandbox.mockRejectedValue(new Error('test-error'));
      await expect(
        buildAccount.buildSandbox(
          mockSandbox.name,
          mockParentAccountConfig,
          HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
          mockParentAccountConfig.env,
          false
        )
      ).rejects.toThrow();
    });
  });
});
