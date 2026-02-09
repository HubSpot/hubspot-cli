import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as personalAccessKeyLib from '@hubspot/local-dev-lib/personalAccessKey';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import {
  addGlobalOptions,
  addTestingOptions,
} from '../../../lib/commonOpts.js';
import * as configMigrate from '../../../lib/configMigrate.js';
import * as processLib from '../../../lib/process.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as personalAccessKeyPromptLib from '../../../lib/prompts/personalAccessKeyPrompt.js';
import * as accountNamePromptLib from '../../../lib/prompts/accountNamePrompt.js';
import * as setAsDefaultPromptLib from '../../../lib/prompts/setAsDefaultAccountPrompt.js';
import * as parsingLib from '../../../lib/parsing.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import accountAuthCommand from '../auth.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('../../../lib/configMigrate.js');
vi.mock('../../../lib/process.js');
vi.mock('../../../lib/prompts/personalAccessKeyPrompt.js');
vi.mock('../../../lib/prompts/accountNamePrompt.js');
vi.mock('../../../lib/prompts/setAsDefaultAccountPrompt.js');
vi.mock('../../../lib/parsing.js');
vi.mock('../../../lib/ui/index.js');
vi.mock('../../../lib/errorHandlers/index.js');

const localConfigFileExistsSpy = vi.spyOn(configLib, 'localConfigFileExists');
const globalConfigFileExistsSpy = vi.spyOn(configLib, 'globalConfigFileExists');
const createEmptyConfigFileSpy = vi.spyOn(configLib, 'createEmptyConfigFile');
const getAccessTokenSpy = vi.spyOn(personalAccessKeyLib, 'getAccessToken');
const updateConfigWithAccessTokenSpy = vi.spyOn(
  personalAccessKeyLib,
  'updateConfigWithAccessToken'
);
const handleMergeSpy = vi.spyOn(configMigrate, 'handleMerge');
const handleMigrationSpy = vi.spyOn(configMigrate, 'handleMigration');
const handleExitSpy = vi.spyOn(processLib, 'handleExit');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const trackAuthActionSpy = vi.spyOn(usageTrackingLib, 'trackAuthAction');
const personalAccessKeyPromptSpy = vi.spyOn(
  personalAccessKeyPromptLib,
  'personalAccessKeyPrompt'
);
const cliAccountNamePromptSpy = vi.spyOn(
  accountNamePromptLib,
  'cliAccountNamePrompt'
);
const setAsDefaultAccountPromptSpy = vi.spyOn(
  setAsDefaultPromptLib,
  'setAsDefaultAccountPrompt'
);
const parseStringToNumberSpy = vi.spyOn(parsingLib, 'parseStringToNumber');
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/account/auth', () => {
  const yargsMock = yargs as Argv;

  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    localConfigFileExistsSpy.mockReturnValue(false);
    globalConfigFileExistsSpy.mockReturnValue(true);
    createEmptyConfigFileSpy.mockImplementation(() => {});
    handleExitSpy.mockImplementation(async () => {});
    trackCommandUsageSpy.mockImplementation(async () => {});
    trackAuthActionSpy.mockResolvedValue(undefined);
    personalAccessKeyPromptSpy.mockResolvedValue({
      personalAccessKey: 'test-key',
      env: 'prod',
    });
    getAccessTokenSpy.mockResolvedValue({
      portalId: 456789,
      accessToken: 'test-access-token',
      expiresAt: '2025-01-01T00:00:00.000Z',
      scopeGroups: ['content'],
      encodedOAuthRefreshToken: 'encoded-token',
      hubName: 'Test Hub',
      accountType: 'STANDARD',
    });
    cliAccountNamePromptSpy.mockResolvedValue({ name: 'test-account' });
    updateConfigWithAccessTokenSpy.mockResolvedValue({
      accountId: 456789,
      name: 'test-account',
      authType: 'personalaccesskey',
      env: 'prod',
      auth: { tokenInfo: { accessToken: 'test-token' } },
      personalAccessKey: 'test-key',
    });
    setAsDefaultAccountPromptSpy.mockResolvedValue(true);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountAuthCommand.command).toEqual('auth');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountAuthCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountAuthCommand.builder(yargsMock);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(addGlobalOptions).toHaveBeenCalledWith(yargsMock);
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<{
      derivedAccountId: number;
      userProvidedAccount?: string;
      d: boolean;
      debug: boolean;
      c?: string;
      config?: string;
      disableTracking?: boolean;
      personalAccessKey?: string;
      qa?: boolean;
    }>;

    beforeEach(() => {
      args = {
        derivedAccountId: 0,
        d: false,
        debug: false,
        _: [],
        $0: '',
      } as ArgumentsCamelCase<{
        derivedAccountId: number;
        userProvidedAccount?: string;
        d: boolean;
        debug: boolean;
        c?: string;
        config?: string;
        disableTracking?: boolean;
        personalAccessKey?: string;
        qa?: boolean;
      }>;
    });

    it('should track command usage', async () => {
      await accountAuthCommand.handler(args);

      expect(trackCommandUsageSpy).toHaveBeenCalledWith(
        'account-auth',
        {},
        undefined
      );
      expect(trackAuthActionSpy).toHaveBeenCalledWith(
        'account-auth',
        'personalaccesskey',
        'started'
      );
    });

    it('should not track when tracking is disabled', async () => {
      args.disableTracking = true;

      await accountAuthCommand.handler(args);

      expect(trackCommandUsageSpy).not.toHaveBeenCalled();
      expect(trackAuthActionSpy).not.toHaveBeenCalled();
      expect(updateConfigWithAccessTokenSpy).toHaveBeenCalled();
    });

    it('should parse user provided account ID', async () => {
      args.userProvidedAccount = '123456';
      parseStringToNumberSpy.mockReturnValue(123456);

      await accountAuthCommand.handler(args);

      expect(parseStringToNumberSpy).toHaveBeenCalledWith('123456');
      expect(trackCommandUsageSpy).toHaveBeenCalledWith(
        'account-auth',
        {},
        123456
      );
    });

    it('should error on invalid account ID', async () => {
      args.userProvidedAccount = 'invalid';
      parseStringToNumberSpy.mockImplementation(() => {
        throw new Error('Invalid');
      });

      await accountAuthCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        '--account must be a number.'
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle merge when both configs exist', async () => {
      localConfigFileExistsSpy.mockReturnValue(true);
      globalConfigFileExistsSpy.mockReturnValue(true);
      handleMergeSpy.mockResolvedValue(true);

      await accountAuthCommand.handler(args);

      expect(handleMergeSpy).toHaveBeenCalled();
    });

    it('should exit if merge is not confirmed', async () => {
      localConfigFileExistsSpy.mockReturnValue(true);
      globalConfigFileExistsSpy.mockReturnValue(true);
      handleMergeSpy.mockResolvedValue(false);

      await accountAuthCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalled();
      expect(trackAuthActionSpy).toHaveBeenCalledWith(
        'account-auth',
        'personalaccesskey',
        'error'
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should handle migration when only local config exists', async () => {
      localConfigFileExistsSpy.mockReturnValue(true);
      globalConfigFileExistsSpy.mockReturnValue(false);
      handleMigrationSpy.mockResolvedValue(true);

      await accountAuthCommand.handler(args);

      expect(handleMigrationSpy).toHaveBeenCalled();
    });

    it('should create config file if it does not exist', async () => {
      globalConfigFileExistsSpy.mockReturnValue(false);

      await accountAuthCommand.handler(args);

      expect(createEmptyConfigFileSpy).toHaveBeenCalledWith(true);
    });

    it('should prompt for personal access key', async () => {
      await accountAuthCommand.handler(args);

      expect(personalAccessKeyPromptSpy).toHaveBeenCalledWith({
        env: ENVIRONMENTS.PROD,
        account: undefined,
      });
    });

    it('should use provided personal access key', async () => {
      args.personalAccessKey = 'provided-key';

      await accountAuthCommand.handler(args);

      expect(personalAccessKeyPromptSpy).not.toHaveBeenCalled();
      expect(getAccessTokenSpy).toHaveBeenCalledWith(
        'provided-key',
        ENVIRONMENTS.PROD
      );
    });

    it('should use QA environment when qa flag is set', async () => {
      args.qa = true;

      await accountAuthCommand.handler(args);

      expect(getAccessTokenSpy).toHaveBeenCalledWith(
        'test-key',
        ENVIRONMENTS.QA
      );
    });

    it('should prompt for account name for new config', async () => {
      globalConfigFileExistsSpy.mockReturnValue(false);

      await accountAuthCommand.handler(args);

      expect(cliAccountNamePromptSpy).toHaveBeenCalledWith('test-hub');
    });

    it('should not prompt for account name for existing config', async () => {
      globalConfigFileExistsSpy.mockReturnValue(true);

      await accountAuthCommand.handler(args);

      expect(setAsDefaultAccountPromptSpy).toHaveBeenCalledWith('test-account');
    });

    it('should exit with error if config update fails', async () => {
      getAccessTokenSpy.mockRejectedValue(new Error('Invalid key'));

      await accountAuthCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed')
      );
      expect(trackAuthActionSpy).toHaveBeenCalledWith(
        'account-auth',
        'personalaccesskey',
        'error'
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log success for new config', async () => {
      globalConfigFileExistsSpy.mockReturnValue(false);

      await accountAuthCommand.handler(args);

      expect(uiLogger.success).toHaveBeenCalled();
      expect(trackAuthActionSpy).toHaveBeenCalledWith(
        'account-auth',
        'personalaccesskey',
        'complete',
        456789
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
