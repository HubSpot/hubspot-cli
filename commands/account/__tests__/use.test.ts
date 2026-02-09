/* eslint-disable @typescript-eslint/no-explicit-any */
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as defaultAccountOverrideLib from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import { uiLogger } from '../../../lib/ui/logger.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/defaultAccountOverride');
vi.mock('../../../lib/prompts/accountsPrompt.js');

// Import after mocks
import * as accountsPromptLib from '../../../lib/prompts/accountsPrompt.js';
import accountUseCommand from '../use.js';

const getConfigFilePathSpy = vi.spyOn(configLib, 'getConfigFilePath');
const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);
const getConfigAccountByNameSpy = vi.spyOn(configLib, 'getConfigAccountByName');
const getConfigAccountByIdSpy = vi.spyOn(configLib, 'getConfigAccountById');
const getAllConfigAccountsSpy = vi.spyOn(configLib, 'getAllConfigAccounts');
const setConfigAccountAsDefaultSpy = vi.spyOn(
  configLib,
  'setConfigAccountAsDefault'
);
const getDefaultAccountOverrideAccountIdSpy = vi.spyOn(
  defaultAccountOverrideLib,
  'getDefaultAccountOverrideAccountId'
);
const getDefaultAccountOverrideFilePathSpy = vi.spyOn(
  defaultAccountOverrideLib,
  'getDefaultAccountOverrideFilePath'
);
const selectAccountFromConfigSpy = vi.spyOn(
  accountsPromptLib,
  'selectAccountFromConfig'
);
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/use', () => {
  const yargsMock = yargs as Argv;

  beforeEach(() => {
    getConfigFilePathSpy.mockReturnValue('/test/.hscli.config.yaml');
    getAllConfigAccountsSpy.mockReturnValue([]);
    getDefaultAccountOverrideAccountIdSpy.mockReturnValue(null);
    getDefaultAccountOverrideFilePathSpy.mockReturnValue(null);
    trackCommandUsageSpy.mockImplementation(async () => {});
    setConfigAccountAsDefaultSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountUseCommand.command).toEqual('use [account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountUseCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountUseCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith('account', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<{
      derivedAccountId: number;
      userProvidedAccount?: string;
      d: boolean;
      debug: boolean;
      account?: string;
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
        account?: string;
      }>;
    });

    describe('with account ID', () => {
      it('should set account by ID', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(getConfigAccountByIdSpy).toHaveBeenCalledWith(123456);
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('123456');
        expect(uiLogger.success).toHaveBeenCalled();
      });

      it('should track command usage', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'accounts-use',
          undefined,
          123456
        );
      });
    });

    describe('with account name', () => {
      it('should set account by name', async () => {
        args.account = 'MyAccount';
        const account = {
          accountId: 123456,
          name: 'MyAccount',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByNameSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(getConfigAccountByNameSpy).toHaveBeenCalledWith('MyAccount');
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('MyAccount');
        expect(uiLogger.success).toHaveBeenCalled();
      });
    });

    describe('account not found', () => {
      it('should prompt when account not found', async () => {
        args.account = 'InvalidAccount';
        const account = {
          accountId: 999999,
          name: 'Selected Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(undefined);
        selectAccountFromConfigSpy.mockResolvedValue(999999);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalled();
        expect(selectAccountFromConfigSpy).toHaveBeenCalled();
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('999999');
      });
    });

    describe('without account argument', () => {
      it('should prompt for account selection', async () => {
        const account = {
          accountId: 888888,
          name: 'Prompted Account',
        };
        selectAccountFromConfigSpy.mockResolvedValue(888888);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(selectAccountFromConfigSpy).toHaveBeenCalled();
        expect(setConfigAccountAsDefaultSpy).toHaveBeenCalledWith('888888');
      });
    });

    describe('account override', () => {
      it('should warn when account override is present', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);
        getDefaultAccountOverrideAccountIdSpy.mockReturnValue(777777);
        getDefaultAccountOverrideFilePathSpy.mockReturnValue(
          '/test/override.yaml'
        );
        getAllConfigAccountsSpy.mockReturnValue([account] as any);

        await accountUseCommand.handler(args);

        expect(getDefaultAccountOverrideAccountIdSpy).toHaveBeenCalled();
        expect(uiLogger.warn).toHaveBeenCalled();
      });

      it('should not warn when no account override', async () => {
        args.account = '123456';
        const account = {
          accountId: 123456,
          name: 'Test Account',
        };
        getConfigAccountIfExistsSpy.mockReturnValue(account as any);
        getConfigAccountByIdSpy.mockReturnValue(account as any);

        await accountUseCommand.handler(args);

        expect(uiLogger.warn).not.toHaveBeenCalled();
      });
    });
  });
});
