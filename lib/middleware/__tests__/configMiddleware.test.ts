import { Arguments } from 'yargs';
import { uiLogger } from '../../ui/logger.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import * as cliConfig from '@hubspot/local-dev-lib/config';
import * as validation from '../../validation.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import {
  injectAccountIdMiddleware,
  validateConfigMiddleware,
  validateAccountOptions,
} from '../configMiddleware.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../validation');

const validateAccountSpy = vi.spyOn(validation, 'validateAccount');
const getConfigAccountIfExistsSpy = vi.spyOn(
  cliConfig,
  'getConfigAccountIfExists'
);
const globalConfigFileExistsSpy = vi.spyOn(cliConfig, 'globalConfigFileExists');
const configFileExistsSpy = vi.spyOn(cliConfig, 'configFileExists');
const getConfigFilePathSpy = vi.spyOn(cliConfig, 'getConfigFilePath');
const validateConfigSpy = vi.spyOn(cliConfig, 'validateConfig');
const processExitSpy = vi.spyOn(process, 'exit');

describe('lib/middleware/configMiddleware', () => {
  beforeEach(() => {
    processExitSpy.mockImplementation(code => {
      throw new Error(`Process.exit called with code ${code}`);
    });
    getConfigFilePathSpy.mockReturnValue('/path/to/config');
  });

  describe('injectAccountIdMiddleware()', () => {
    it('should use HUBSPOT_ACCOUNT_ID from environment when useEnv is true', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        HUBSPOT_ACCOUNT_ID: '123',
      };

      const argv: Arguments<{ account?: string }> = {
        _: ['some-command'],
        useEnv: true,
        $0: 'hs',
      };

      await injectAccountIdMiddleware(argv);

      expect(argv.userProvidedAccount).toBeUndefined();
      expect(argv.derivedAccountId).toBe(123);
      expect(getConfigAccountIfExistsSpy).not.toHaveBeenCalled();

      process.env = originalEnv;
    });

    it('should use getAccountId when useEnv is false', async () => {
      getConfigAccountIfExistsSpy.mockReturnValue({
        accountId: 456,
      } as HubSpotConfigAccount);

      const argv: Arguments<{ account?: string }> = {
        _: ['some-command'],
        account: 'test-account',
        useEnv: false,
        $0: 'hs',
      };

      await injectAccountIdMiddleware(argv);

      expect(argv.userProvidedAccount).toBe('test-account');
      expect(argv.derivedAccountId).toBe(456);
      expect(getConfigAccountIfExistsSpy).toHaveBeenCalledWith('test-account');
    });
  });

  describe('validateConfigMiddleware()', () => {
    it('should allow using --config flag', async () => {
      configFileExistsSpy.mockReturnValue(true);
      validateConfigSpy.mockReturnValue({ isValid: true, errors: [] });

      const argv: Arguments = {
        _: ['some-command'],
        config: 'custom-config.json',
        $0: 'hs',
      };

      await validateConfigMiddleware(argv);

      // Should not throw or exit - this is now allowed
      expect(processExitSpy).not.toHaveBeenCalled();
      expect(uiLogger.error).not.toHaveBeenCalled();
    });

    it('should validate config for non-init commands', async () => {
      globalConfigFileExistsSpy.mockReturnValue(true);
      validateConfigSpy.mockReturnValue({ isValid: true, errors: [] });

      const argv: Arguments = {
        _: ['some-command'],
        $0: 'hs',
      };

      await validateConfigMiddleware(argv);

      expect(validateConfigSpy).toHaveBeenCalled();
    });

    it('should skip validation for init command', async () => {
      globalConfigFileExistsSpy.mockReturnValue(false);

      const argv: Arguments = {
        _: ['init'],
        $0: 'hs',
      };

      await validateConfigMiddleware(argv);

      expect(validateConfigSpy).not.toHaveBeenCalled();
    });
  });

  describe('validateAccountOptions()', () => {
    it('should validate account for non-skipped commands', async () => {
      validateAccountSpy.mockResolvedValue(true);

      const argv: Arguments = {
        _: ['some-command'],
        $0: 'hs',
      };

      await validateAccountOptions(argv);

      expect(validateAccountSpy).toHaveBeenCalledWith(argv);
    });

    it('should skip validation for init command', async () => {
      const argv: Arguments = {
        _: ['init'],
        $0: 'hs',
      };

      await validateAccountOptions(argv);

      expect(validateAccountSpy).not.toHaveBeenCalled();
    });

    it('should exit with error when account validation fails', async () => {
      validateAccountSpy.mockResolvedValue(false);

      const argv: Arguments = {
        _: ['some-command'],
        $0: 'hs',
      };

      await expect(validateAccountOptions(argv)).rejects.toThrow();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
