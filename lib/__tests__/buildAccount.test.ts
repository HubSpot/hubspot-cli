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
import {
  createDeveloperTestAccount,
  fetchDeveloperTestAccountGateSyncStatus,
  generateDeveloperTestAccountPersonalAccessKey,
} from '@hubspot/local-dev-lib/api/developerTestAccounts';
import {
  createSandbox,
  createV2Sandbox,
  getSandboxPersonalAccessKey,
} from '@hubspot/local-dev-lib/api/sandboxHubs';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import { personalAccessKeyPrompt } from '../prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from '../prompts/accountNamePrompt.js';
import * as buildAccount from '../buildAccount.js';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/api/developerTestAccounts');
vi.mock('@hubspot/local-dev-lib/api/sandboxHubs');
vi.mock('../ui/logger.js');
vi.mock('../errorHandlers/index.js');
vi.mock('../prompts/personalAccessKeyPrompt');
vi.mock('../prompts/accountNamePrompt');
vi.mock('../ui/SpinniesManager', () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  },
}));

const mockedPersonalAccessKeyPrompt = personalAccessKeyPrompt as Mock;
const mockedGetAccessToken = getAccessToken as Mock;
const mockedUpdateConfigWithAccessToken = updateConfigWithAccessToken as Mock;
const mockedAccountNameExistsInConfig = accountNameExistsInConfig as Mock;
const mockedUpdateAccountConfig = updateAccountConfig as Mock;
const mockedWriteConfig = writeConfig as Mock;
const mockedCliAccountNamePrompt = cliAccountNamePrompt as Mock;
const mockedGetAccountId = getAccountId as Mock;
const mockedCreateDeveloperTestAccount = createDeveloperTestAccount as Mock;
const mockedFetchDeveloperTestAccountGateSyncStatus =
  fetchDeveloperTestAccountGateSyncStatus as Mock;
const mockedGenerateDeveloperTestAccountPersonalAccessKey =
  generateDeveloperTestAccountPersonalAccessKey as Mock;
const mockedCreateSandbox = createSandbox as Mock;
const mockedCreateV2Sandbox = createV2Sandbox as Mock;
const mockedGetPersonalAccessKey = getSandboxPersonalAccessKey as Mock;

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
      vi.clearAllMocks();
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

  describe('createDeveloperTestAccountV2()', () => {
    const parentAccountId = 123456;
    const mockDeveoperTestAccountConfig = {
      accountName: 'Developer Test Account',
      description: 'Test Account created by the HubSpot CLI',
    };

    beforeEach(() => {
      mockedCreateDeveloperTestAccount.mockResolvedValue({
        data: { id: 123456 },
      });
      mockedFetchDeveloperTestAccountGateSyncStatus.mockResolvedValue({
        data: { status: 'SUCCESS' },
      });
      mockedGenerateDeveloperTestAccountPersonalAccessKey.mockResolvedValue({
        data: { personalAccessKey: 'test-key' },
      });
    });

    it('should create a developer test account successfully', async () => {
      const result = await buildAccount.createDeveloperTestAccountV2(
        parentAccountId,
        mockDeveoperTestAccountConfig
      );
      expect(result).toEqual({
        accountName: mockDeveoperTestAccountConfig.accountName,
        accountId: 123456,
        personalAccessKey: 'test-key',
      });
    }, 10000);
  });

  describe('buildDeveloperTestAccount()', () => {
    const mockParentAccountConfig = {
      name: 'Developer Account',
      accountId: 123456,
      accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
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
      vi.spyOn(buildAccount, 'saveAccountToConfig').mockResolvedValue(
        mockParentAccountConfig.name
      );
      mockedGetAccountId.mockReturnValue(mockParentAccountConfig.accountId);
      mockedCreateDeveloperTestAccount.mockResolvedValue({
        data: mockDeveloperTestAccount,
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create a developer test account successfully', async () => {
      const result = await buildAccount.buildDeveloperTestAccount(
        mockDeveloperTestAccount.accountName,
        mockParentAccountConfig,
        mockParentAccountConfig.env,
        10
      );
      expect(result).toEqual(mockDeveloperTestAccount.id);
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
      name: 'Prod account',
      accountId: 123456,
      accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
      env: 'prod' as Environment,
    };
    const mockSandbox = {
      sandboxHubId: 56789,
      parentHubId: 123456,
      createdAt: '2025-01-01',
      type: 'STANDARD',
      version: 'V1',
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
      vi.spyOn(buildAccount, 'saveAccountToConfig').mockResolvedValue(
        mockParentAccountConfig.name
      );
      mockedGetAccountId.mockReturnValue(mockParentAccountConfig.accountId);
      mockedCreateSandbox.mockResolvedValue({
        data: { sandbox: mockSandbox, personalAccessKey: 'test-key' },
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
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

  describe('buildV2Sandbox()', () => {
    const mockParentAccountConfig = {
      name: 'Prod account',
      accountId: 123456,
      accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
      env: 'prod' as Environment,
    };
    const mockSandbox = {
      sandboxHubId: 56789,
      parentHubId: 123456,
      createdAt: '2025-01-01',
      type: 'STANDARD',
      archived: false,
      version: 'V2',
      name: 'Test v2 Sandbox',
      domain: 'test-v2-sandbox.hubspot.com',
      createdByUser: {
        id: 123456,
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
      },
    };

    beforeEach(() => {
      vi.spyOn(buildAccount, 'saveAccountToConfig').mockResolvedValue(
        mockParentAccountConfig.name
      );
      mockedGetAccountId.mockReturnValue(mockParentAccountConfig.accountId);
      mockedCreateV2Sandbox.mockResolvedValue({
        data: mockSandbox,
      });
      mockedGetPersonalAccessKey.mockResolvedValue({
        data: { personalAccessKey: { encodedOAuthRefreshToken: 'test-key' } },
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create a v2 standard sandbox successfully and fetch a personal access key', async () => {
      const result = await buildAccount.buildV2Sandbox(
        mockSandbox.name,
        mockParentAccountConfig,
        HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
        false,
        mockParentAccountConfig.env,
        false
      );
      expect(result).toEqual({ sandbox: mockSandbox });
      expect(mockedGetPersonalAccessKey).toHaveBeenCalledWith(
        mockParentAccountConfig.accountId,
        mockSandbox.sandboxHubId
      );
    });

    it('should create a development sandbox successfully and fetch a personal access key', async () => {
      const result = await buildAccount.buildV2Sandbox(
        mockSandbox.name,
        mockParentAccountConfig,
        HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        false,
        mockParentAccountConfig.env,
        false
      );
      expect(result).toEqual({ sandbox: mockSandbox });
      expect(mockedGetPersonalAccessKey).toHaveBeenCalledWith(
        mockParentAccountConfig.accountId,
        mockSandbox.sandboxHubId
      );
    });

    it('should throw error if account ID is not found', async () => {
      mockedGetAccountId.mockReturnValue(null);
      await expect(
        buildAccount.buildV2Sandbox(
          mockSandbox.name,
          mockParentAccountConfig,
          HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
          false,
          mockParentAccountConfig.env,
          false
        )
      ).rejects.toThrow();
    });

    it('should handle API errors when creating sandbox', async () => {
      mockedCreateV2Sandbox.mockRejectedValue(new Error('test-error'));
      await expect(
        buildAccount.buildV2Sandbox(
          mockSandbox.name,
          mockParentAccountConfig,
          HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
          false,
          mockParentAccountConfig.env,
          false
        )
      ).rejects.toThrow();
    });
  });
});
