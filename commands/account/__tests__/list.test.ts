/* eslint-disable @typescript-eslint/no-explicit-any */
import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as defaultAccountOverrideLib from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import * as hsSettingsLib from '@hubspot/local-dev-lib/config/hsSettings';
import { HUBSPOT_ACCOUNT_TYPES } from '@hubspot/local-dev-lib/constants/config';
import * as commonOpts from '../../../lib/commonOpts.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import type { UsageTrackingArgs } from '../../../types/Yargs.js';
import accountListCommand from '../list.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/config/defaultAccountOverride');
vi.mock('@hubspot/local-dev-lib/config/hsSettings');
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn().mockReturnValue('/test/project'),
  getExt: vi.fn(),
  isRelativePath: vi.fn(),
  resolveLocalPath: vi.fn(),
}));
vi.mock('../../../lib/ui/index.js');
vi.mock('../../../lib/ui/table.js');
vi.mock('../../../lib/link/renderLinkedAccountsTable.js', () => ({
  renderLinkedAccountsTable: vi.fn().mockResolvedValue(undefined),
}));

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
const getHsSettingsFileIfExistsSpy = vi.spyOn(
  hsSettingsLib,
  'getHsSettingsFileIfExists'
);
const getHsSettingsFilePathSpy = vi.spyOn(
  hsSettingsLib,
  'getHsSettingsFilePath'
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
    getHsSettingsFileIfExistsSpy.mockReturnValue(null);
    getHsSettingsFilePathSpy.mockReturnValue(null);
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
    let args: ArgumentsCamelCase<
      {
        derivedAccountId: number;
        userProvidedAccount?: string;
        d: boolean;
        debug: boolean;
        c?: string;
        config?: string;
      } & UsageTrackingArgs
    >;

    beforeEach(() => {
      args = {
        derivedAccountId: 123456,
        d: false,
        debug: false,
        _: [],
        $0: '',
        addUsageMetadata: vi.fn(),
        exit: vi.fn(),
      } as ArgumentsCamelCase<
        {
          derivedAccountId: number;
          userProvidedAccount?: string;
          d: boolean;
          debug: boolean;
          c?: string;
          config?: string;
        } & UsageTrackingArgs
      >;
    });

    it('should track command usage', async () => {
      await accountListCommand.handler(args);

      expect(trackCommandUsageSpy).toHaveBeenCalledWith(
        'accounts-list',
        { successful: true },
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

    it('should show linked default title and settings path in linked directory', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');

      await accountListCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Linked Default Account')
      );
      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('.hs/settings.json')
      );
    });

    it('should show linked accounts label in linked directory', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');

      await accountListCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Linked Accounts')
      );
    });

    it('should not show override section in linked directory', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');
      getDefaultAccountOverrideFilePathSpy.mockReturnValue('/test/.hsaccount');
      getConfigDefaultAccountIfExistsSpy.mockReturnValue({
        accountId: 111,
      } as any);

      await accountListCommand.handler(args);

      expect(uiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Default Account Override')
      );
    });

    it('should fall back to global config display when settings file has empty accounts', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [],
        localDefaultAccount: undefined,
      });
      getConfigDefaultAccountIfExistsSpy.mockReturnValue({
        accountId: 123456,
      } as any);

      await accountListCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Default Account')
      );
      expect(uiLogger.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Linked Default Account')
      );
    });

    it('should always show all accounts section even in linked directory', async () => {
      getHsSettingsFileIfExistsSpy.mockReturnValue({
        accounts: [111],
        localDefaultAccount: 111,
      });
      getHsSettingsFilePathSpy.mockReturnValue('/test/.hs/settings.json');

      await accountListCommand.handler(args);

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Accounts')
      );
    });
  });
});
