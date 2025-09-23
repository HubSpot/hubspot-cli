import { getAccountIdFromCliConfig } from '../cliConfig.js';
import {
  configFileExists,
  findConfig,
  getAccountId,
  loadConfig,
} from '@hubspot/local-dev-lib/config';
import { MockedFunction } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');

const mockConfigFileExists = configFileExists as MockedFunction<
  typeof configFileExists
>;
const mockFindConfig = findConfig as MockedFunction<typeof findConfig>;
const mockGetAccountId = getAccountId as MockedFunction<typeof getAccountId>;
const mockLoadConfig = loadConfig as MockedFunction<typeof loadConfig>;

describe('mcp-server/utils/cliConfig', () => {
  const mockWorkingDirectory = '/test/working/directory';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccountIdFromCliConfig', () => {
    it('should load global config when it exists and return account ID', () => {
      const expectedAccountId = 12345;

      mockConfigFileExists.mockReturnValue(true);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(mockWorkingDirectory);

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockLoadConfig).toHaveBeenCalledWith('');
      expect(mockFindConfig).not.toHaveBeenCalled();
      expect(mockGetAccountId).toHaveBeenCalledWith(undefined);
      expect(result).toBe(expectedAccountId);
    });

    it('should load local config when global config does not exist and return account ID', () => {
      const expectedAccountId = 67890;
      const localConfigPath = '/path/to/local/config';

      mockConfigFileExists.mockReturnValue(false);
      mockFindConfig.mockReturnValue(localConfigPath);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(mockWorkingDirectory);

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockFindConfig).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(mockLoadConfig).toHaveBeenCalledWith(localConfigPath);
      expect(mockGetAccountId).toHaveBeenCalledWith(undefined);
      expect(result).toBe(expectedAccountId);
    });

    it('should pass accountNameOrId parameter to getAccountId when provided as string', () => {
      const expectedAccountId = 11111;
      const accountName = 'test-account';

      mockConfigFileExists.mockReturnValue(true);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(
        mockWorkingDirectory,
        accountName
      );

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockLoadConfig).toHaveBeenCalledWith('');
      expect(mockGetAccountId).toHaveBeenCalledWith(accountName);
      expect(result).toBe(expectedAccountId);
    });

    it('should pass accountNameOrId parameter to getAccountId when provided as number', () => {
      const expectedAccountId = 22222;
      const accountId = 22222;

      mockConfigFileExists.mockReturnValue(true);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(mockWorkingDirectory, accountId);

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockLoadConfig).toHaveBeenCalledWith('');
      expect(mockGetAccountId).toHaveBeenCalledWith(accountId);
      expect(result).toBe(expectedAccountId);
    });

    it('should return null when getAccountId returns null', () => {
      mockConfigFileExists.mockReturnValue(true);
      mockGetAccountId.mockReturnValue(null);

      const result = getAccountIdFromCliConfig(mockWorkingDirectory);

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockLoadConfig).toHaveBeenCalledWith('');
      expect(mockGetAccountId).toHaveBeenCalledWith(undefined);
      expect(result).toBeNull();
    });

    it('should handle findConfig returning null by passing null to loadConfig', () => {
      const expectedAccountId = 33333;

      mockConfigFileExists.mockReturnValue(false);
      mockFindConfig.mockReturnValue(null);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(mockWorkingDirectory);

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockFindConfig).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(mockLoadConfig).toHaveBeenCalledWith(null);
      expect(mockGetAccountId).toHaveBeenCalledWith(undefined);
      expect(result).toBe(expectedAccountId);
    });

    it('should work with local config when provided with account name parameter', () => {
      const expectedAccountId = 44444;
      const accountName = 'local-test-account';
      const localConfigPath = '/path/to/local/config';

      mockConfigFileExists.mockReturnValue(false);
      mockFindConfig.mockReturnValue(localConfigPath);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(
        mockWorkingDirectory,
        accountName
      );

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockFindConfig).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(mockLoadConfig).toHaveBeenCalledWith(localConfigPath);
      expect(mockGetAccountId).toHaveBeenCalledWith(accountName);
      expect(result).toBe(expectedAccountId);
    });

    it('should work with local config when provided with account ID parameter', () => {
      const expectedAccountId = 55555;
      const accountId = 55555;
      const localConfigPath = '/path/to/local/config';

      mockConfigFileExists.mockReturnValue(false);
      mockFindConfig.mockReturnValue(localConfigPath);
      mockGetAccountId.mockReturnValue(expectedAccountId);

      const result = getAccountIdFromCliConfig(mockWorkingDirectory, accountId);

      expect(mockConfigFileExists).toHaveBeenCalledWith(true);
      expect(mockFindConfig).toHaveBeenCalledWith(mockWorkingDirectory);
      expect(mockLoadConfig).toHaveBeenCalledWith(localConfigPath);
      expect(mockGetAccountId).toHaveBeenCalledWith(accountId);
      expect(result).toBe(expectedAccountId);
    });
  });
});
