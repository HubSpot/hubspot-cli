import {
  updateConfigAccount,
  createEmptyConfigFile,
  getConfigFilePath,
  localConfigFileExists,
  globalConfigFileExists,
  setConfigAccountAsDefault,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import {
  getAccessToken,
  updateConfigWithAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { toKebabCase } from '@hubspot/local-dev-lib/text';
import {
  AccessToken,
  Environment,
  PersonalAccessKeyConfigAccount,
} from '@hubspot/local-dev-lib/types/Accounts';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { handleMerge, handleMigration } from '../configMigrate.js';
import { legacyPersonalAccessKeyPrompt as personalAccessKeyPrompt } from '../prompts/personalAccessKeyPrompt.js';
import { cliAccountNamePrompt } from '../prompts/accountNamePrompt.js';
import { setAsDefaultAccountPrompt } from '../prompts/setAsDefaultAccountPrompt.js';
import { awaitPersonalAccessKeyOverWebsocket } from '../auth/awaitPersonalAccessKeyOverWebsocket.js';
import { authenticateNewAccount } from '../accountAuth.js';
import { Mock } from 'vitest';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('@hubspot/local-dev-lib/text');
vi.mock('../configMigrate.js');
vi.mock('../errorHandlers/index.js');
vi.mock('../prompts/personalAccessKeyPrompt.js');
vi.mock('../prompts/accountNamePrompt.js');
vi.mock('../prompts/setAsDefaultAccountPrompt.js');
vi.mock('../auth/awaitPersonalAccessKeyOverWebsocket.js');
vi.mock('../ui/logger.js', () => ({
  uiLogger: {
    log: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedUpdateConfigAccount = updateConfigAccount as Mock;
const mockedCreateEmptyConfigFile = createEmptyConfigFile as Mock;
const mockedGetConfigFilePath = getConfigFilePath as Mock;
const mockedLocalConfigFileExists = localConfigFileExists as Mock;
const mockedGlobalConfigFileExists = globalConfigFileExists as Mock;
const mockedSetConfigAccountAsDefault = setConfigAccountAsDefault as Mock;
const mockedGetConfigDefaultAccountIfExists =
  getConfigDefaultAccountIfExists as Mock;
const mockedGetAccessToken = getAccessToken as Mock;
const mockedUpdateConfigWithAccessToken = updateConfigWithAccessToken as Mock;
const mockedToKebabCase = toKebabCase as Mock;
const mockedHandleMerge = handleMerge as Mock;
const mockedHandleMigration = handleMigration as Mock;
const mockedPersonalAccessKeyPrompt = personalAccessKeyPrompt as Mock;
const mockedCliAccountNamePrompt = cliAccountNamePrompt as Mock;
const mockedSetAsDefaultAccountPrompt = setAsDefaultAccountPrompt as Mock;
const mockedAwaitPersonalAccessKeyOverWebsocket =
  awaitPersonalAccessKeyOverWebsocket as Mock;

describe('lib/accountAuth', () => {
  describe('authenticateNewAccount()', () => {
    const mockAccessToken: AccessToken = {
      portalId: 123456,
      accessToken: 'test-token',
      expiresAt: '2025-01-01',
      scopeGroups: ['test-scope'],
      enabledFeatures: { 'test-feature': 1 },
      encodedOAuthRefreshToken: 'test-refresh-token',
      hubName: 'Test Hub',
      accountType: 'STANDARD',
    };

    const mockAccountConfig: PersonalAccessKeyConfigAccount = {
      name: 'test-hub',
      accountId: 123456,
      env: 'prod' as Environment,
      accountType: 'STANDARD',
      authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
      personalAccessKey: 'test-key',
      auth: {
        tokenInfo: {
          accessToken: 'test-token',
          expiresAt: '2025-01-01',
        },
      },
    };

    const originalBrowserEnv = process.env.BROWSER;

    beforeEach(() => {
      vi.clearAllMocks();
      delete process.env.BROWSER;
      mockedLocalConfigFileExists.mockReturnValue(false);
      mockedGlobalConfigFileExists.mockReturnValue(false);
      mockedGetAccessToken.mockResolvedValue(mockAccessToken);
      mockedUpdateConfigWithAccessToken.mockResolvedValue(mockAccountConfig);
      mockedToKebabCase.mockReturnValue('test-hub');
      mockedCliAccountNamePrompt.mockResolvedValue({ name: 'test-hub' });
      mockedGetConfigFilePath.mockReturnValue('/path/to/config');
      mockedPersonalAccessKeyPrompt.mockResolvedValue({
        personalAccessKey: 'test-key',
      });
      mockedAwaitPersonalAccessKeyOverWebsocket.mockResolvedValue('test-key');
    });

    afterEach(() => {
      if (originalBrowserEnv === undefined) {
        delete process.env.BROWSER;
      } else {
        process.env.BROWSER = originalBrowserEnv;
      }
    });

    it('should create config file if it does not exist', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(false);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedCreateEmptyConfigFile).toHaveBeenCalledWith(true);
    });

    it('should not create config file if it already exists', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedCreateEmptyConfigFile).not.toHaveBeenCalled();
    });

    it('should use provided personal access key without prompting', async () => {
      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedPersonalAccessKeyPrompt).not.toHaveBeenCalled();
      expect(mockedGetAccessToken).toHaveBeenCalledWith('test-key', 'prod');
    });

    it('should request personal access key over websocket if not provided', async () => {
      await authenticateNewAccount({
        env: 'prod' as Environment,
        accountId: 123456,
      });

      expect(mockedAwaitPersonalAccessKeyOverWebsocket).toHaveBeenCalledWith({
        env: 'prod',
        account: 123456,
      });
      expect(mockedPersonalAccessKeyPrompt).not.toHaveBeenCalled();
      expect(mockedGetAccessToken).toHaveBeenCalledWith('test-key', 'prod');
    });

    it('should fall back to the paste prompt if the websocket flow fails', async () => {
      mockedAwaitPersonalAccessKeyOverWebsocket.mockRejectedValue(
        new Error('timeout')
      );

      await authenticateNewAccount({
        env: 'prod' as Environment,
        accountId: 123456,
      });

      expect(mockedAwaitPersonalAccessKeyOverWebsocket).toHaveBeenCalled();
      expect(mockedPersonalAccessKeyPrompt).toHaveBeenCalledWith({
        env: 'prod',
        account: 123456,
      });
      expect(mockedGetAccessToken).toHaveBeenCalledWith('test-key', 'prod');
    });

    it('should skip the websocket flow when BROWSER is none', async () => {
      process.env.BROWSER = 'none';

      await authenticateNewAccount({
        env: 'prod' as Environment,
        accountId: 123456,
      });

      expect(mockedAwaitPersonalAccessKeyOverWebsocket).not.toHaveBeenCalled();
      expect(mockedPersonalAccessKeyPrompt).toHaveBeenCalledWith({
        env: 'prod',
        account: 123456,
      });
    });

    it('should prompt for account name if config does not exist', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(false);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedCliAccountNamePrompt).toHaveBeenCalledWith('test-hub');
    });

    it('should use provided account name without prompting', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(false);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
        accountName: 'my-account',
      });

      expect(mockedCliAccountNamePrompt).not.toHaveBeenCalled();
      expect(mockedUpdateConfigWithAccessToken).toHaveBeenCalledWith(
        expect.anything(),
        'test-key',
        'prod',
        'my-account',
        true
      );
    });

    it('should use the default name without prompting when useDefaultAccountName is true', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(false);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
        useDefaultAccountName: true,
      });

      expect(mockedCliAccountNamePrompt).not.toHaveBeenCalled();
      expect(mockedUpdateConfigWithAccessToken).toHaveBeenCalledWith(
        expect.anything(),
        'test-key',
        'prod',
        'test-hub',
        true
      );
    });

    it('should fall back to the prompt when useDefaultAccountName is true but no hub name exists', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(false);
      mockedToKebabCase.mockReturnValue(undefined);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
        useDefaultAccountName: true,
      });

      expect(mockedCliAccountNamePrompt).toHaveBeenCalled();
    });

    it('should not prompt for account name if config already exists', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedCliAccountNamePrompt).not.toHaveBeenCalled();
    });

    it('should not prompt for account name when reauthenticating with existing config and no flags', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedCliAccountNamePrompt).not.toHaveBeenCalled();
      expect(mockedUpdateConfigWithAccessToken).toHaveBeenCalledWith(
        expect.anything(),
        'test-key',
        'prod',
        undefined,
        false
      );
    });

    it('should set account as default when setAsDefaultAccount is true', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue(undefined);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
        setAsDefaultAccount: true,
      });

      expect(mockedSetConfigAccountAsDefault).toHaveBeenCalledWith('test-hub');
    });

    it('should not set as default when setAsDefaultAccount is true but account is already default', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);
      mockedGetConfigDefaultAccountIfExists.mockReturnValue({
        name: 'test-hub',
      });

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
        setAsDefaultAccount: true,
      });

      expect(mockedSetConfigAccountAsDefault).not.toHaveBeenCalled();
    });

    it('should skip the default prompt when setAsDefaultAccount is false', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
        setAsDefaultAccount: false,
      });

      expect(mockedSetConfigAccountAsDefault).not.toHaveBeenCalled();
      expect(mockedSetAsDefaultAccountPrompt).not.toHaveBeenCalled();
    });

    it('should prompt to set as default when setAsDefaultAccount is not provided and config exists', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedSetAsDefaultAccountPrompt).toHaveBeenCalledWith('test-hub');
    });

    it('should return the updated account config on success', async () => {
      const result = await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(result).toEqual(mockAccountConfig);
    });

    it('should return null if access token fetch fails', async () => {
      mockedGetAccessToken.mockRejectedValue(new Error('Invalid token'));

      const result = await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(result).toBeNull();
    });

    it('should return null if config update fails', async () => {
      mockedUpdateConfigWithAccessToken.mockResolvedValue(null);

      const result = await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(result).toBeNull();
    });

    it('should handle missing account name and prompt for it', async () => {
      mockedGlobalConfigFileExists.mockReturnValue(true);
      mockedUpdateConfigWithAccessToken.mockResolvedValue({
        ...mockAccountConfig,
        name: undefined,
      });
      mockedCliAccountNamePrompt.mockResolvedValue({
        name: 'new-account-name',
      });

      await authenticateNewAccount({
        env: 'prod' as Environment,
        providedPersonalAccessKey: 'test-key',
        accountId: 123456,
      });

      expect(mockedCliAccountNamePrompt).toHaveBeenCalledWith('test-hub');
      expect(mockedUpdateConfigAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'new-account-name',
        })
      );
    });

    describe('config migration', () => {
      it('should handle migration when local config exists and global does not', async () => {
        mockedLocalConfigFileExists.mockReturnValue(true);
        mockedGlobalConfigFileExists.mockReturnValue(false);
        mockedHandleMigration.mockResolvedValue(true);

        await authenticateNewAccount({
          env: 'prod' as Environment,
          providedPersonalAccessKey: 'test-key',
          accountId: 123456,
        });

        expect(mockedHandleMigration).toHaveBeenCalled();
        expect(mockedHandleMerge).not.toHaveBeenCalled();
      });

      it('should handle merge when both local and global configs exist', async () => {
        mockedLocalConfigFileExists.mockReturnValue(true);
        mockedGlobalConfigFileExists.mockReturnValue(true);
        mockedHandleMerge.mockResolvedValue(true);

        await authenticateNewAccount({
          env: 'prod' as Environment,
          providedPersonalAccessKey: 'test-key',
          accountId: 123456,
        });

        expect(mockedHandleMerge).toHaveBeenCalled();
        expect(mockedHandleMigration).not.toHaveBeenCalled();
      });

      it('should return null if migration is not confirmed', async () => {
        mockedLocalConfigFileExists.mockReturnValue(true);
        mockedGlobalConfigFileExists.mockReturnValue(false);
        mockedHandleMigration.mockResolvedValue(false);

        const result = await authenticateNewAccount({
          env: 'prod' as Environment,
          providedPersonalAccessKey: 'test-key',
          accountId: 123456,
        });

        expect(result).toBeNull();
      });

      it('should return null if merge is not confirmed', async () => {
        mockedLocalConfigFileExists.mockReturnValue(true);
        mockedGlobalConfigFileExists.mockReturnValue(true);
        mockedHandleMerge.mockResolvedValue(false);

        const result = await authenticateNewAccount({
          env: 'prod' as Environment,
          providedPersonalAccessKey: 'test-key',
          accountId: 123456,
        });

        expect(result).toBeNull();
      });

      it('should return null if migration throws error', async () => {
        mockedLocalConfigFileExists.mockReturnValue(true);
        mockedGlobalConfigFileExists.mockReturnValue(false);
        mockedHandleMigration.mockRejectedValue(new Error('Migration failed'));

        const result = await authenticateNewAccount({
          env: 'prod' as Environment,
          providedPersonalAccessKey: 'test-key',
          accountId: 123456,
        });

        expect(result).toBeNull();
      });
    });
  });
});
