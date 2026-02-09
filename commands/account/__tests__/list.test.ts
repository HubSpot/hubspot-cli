/* eslint-disable @typescript-eslint/no-explicit-any */
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as defaultAccountOverrideLib from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import * as commonOpts from '../../../lib/commonOpts.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import accountListCommand from '../list.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/defaultAccountOverride');
vi.mock('../../../lib/ui/index.js');
vi.mock('../../../lib/ui/table.js');

const getConfigFilePathSpy = vi.spyOn(configLib, 'getConfigFilePath');
const getAllConfigAccountsSpy = vi.spyOn(configLib, 'getAllConfigAccounts');
const getConfigDefaultAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigDefaultAccountIfExists'
);
const getDefaultAccountOverrideFilePathSpy = vi.spyOn(
  defaultAccountOverrideLib,
  'getDefaultAccountOverrideFilePath'
);
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');

const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/list', () => {
  const yargsMock = yargs as Argv;

  beforeEach(() => {
    getConfigFilePathSpy.mockReturnValue('/test/.hscli.config.yaml');
    getAllConfigAccountsSpy.mockReturnValue([]);
    getConfigDefaultAccountIfExistsSpy.mockReturnValue(undefined);
    getDefaultAccountOverrideFilePathSpy.mockReturnValue(null);
    trackCommandUsageSpy.mockImplementation(async () => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountListCommand.command).toEqual(['list', 'ls']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountListCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountListCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);

      expect(commonOpts.addConfigOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addConfigOptions).toHaveBeenCalledWith(yargsMock);
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
    }>;

    beforeEach(() => {
      args = {
        derivedAccountId: 123456,
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
      }>;
    });

    it('should track command usage', async () => {
      await accountListCommand.handler(args);

      expect(trackCommandUsageSpy).toHaveBeenCalledWith(
        'accounts-list',
        undefined,
        123456
      );
    });

    it('should display accounts list when no default account', async () => {
      const accounts = [
        {
          accountId: 111111,
          name: 'Test Account 1',
          authType: 'personalaccesskey',
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        },
        {
          accountId: 222222,
          name: 'Test Account 2',
          authType: 'oauth2',
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        },
      ];
      getAllConfigAccountsSpy.mockReturnValue(accounts as any);

      await accountListCommand.handler(args);

      expect(getAllConfigAccountsSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Accounts')
      );
    });

    it('should display default account when present', async () => {
      getConfigDefaultAccountIfExistsSpy.mockReturnValue({
        accountId: 123456,
        name: 'Default Account',
      } as any);

      await accountListCommand.handler(args);

      expect(getConfigDefaultAccountIfExistsSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalled();
    });

    it('should display config file path when default account present', async () => {
      getConfigDefaultAccountIfExistsSpy.mockReturnValue({
        accountId: 123456,
      } as any);

      await accountListCommand.handler(args);

      expect(getConfigFilePathSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalled();
    });

    it('should display override file path when present', async () => {
      getConfigDefaultAccountIfExistsSpy.mockReturnValue({
        accountId: 123456,
      } as any);
      getDefaultAccountOverrideFilePathSpy.mockReturnValue(
        '/test/override.yaml'
      );

      await accountListCommand.handler(args);

      expect(getDefaultAccountOverrideFilePathSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalled();
    });

    it('should group sandbox accounts under parent', async () => {
      const accounts = [
        {
          accountId: 111111,
          name: 'Parent Account',
          authType: 'personalaccesskey',
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
        },
        {
          accountId: 222222,
          name: 'Sandbox Account',
          authType: 'personalaccesskey',
          accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX,
          parentAccountId: 111111,
        },
      ];
      getAllConfigAccountsSpy.mockReturnValue(accounts as any);

      await accountListCommand.handler(args);

      expect(getAllConfigAccountsSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalled();
    });

    it('should display app developer accounts', async () => {
      const accounts = [
        {
          accountId: 333333,
          name: 'App Developer Account',
          authType: 'personalaccesskey',
          accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
        },
      ];
      getAllConfigAccountsSpy.mockReturnValue(accounts as any);

      await accountListCommand.handler(args);

      expect(getAllConfigAccountsSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalled();
    });

    it('should handle empty accounts list', async () => {
      getAllConfigAccountsSpy.mockReturnValue([]);

      await accountListCommand.handler(args);

      expect(getAllConfigAccountsSpy).toHaveBeenCalled();
      expect(uiLogger.log).toHaveBeenCalled();
    });
  });
});
