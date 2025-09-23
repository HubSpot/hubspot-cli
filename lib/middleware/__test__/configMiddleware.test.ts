import { Arguments } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { CLIConfig } from '@hubspot/local-dev-lib/types/Config';
import * as cliConfig from '@hubspot/local-dev-lib/config';
import * as validation from '../../validation.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import {
  handleDeprecatedEnvVariables,
  injectAccountIdMiddleware,
  loadConfigMiddleware,
  validateAccountOptions,
} from '../configMiddleware.js';

vi.mock('@hubspot/local-dev-lib/logger', () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../validation');

const validateAccountSpy = vi.spyOn(validation, 'validateAccount');
const loadConfigSpy = vi.spyOn(cliConfig, 'loadConfig');
const getAccountIdSpy = vi.spyOn(cliConfig, 'getAccountId');
const configFileExistsSpy = vi.spyOn(cliConfig, 'configFileExists');
const getConfigPathSpy = vi.spyOn(cliConfig, 'getConfigPath');
const validateConfigSpy = vi.spyOn(cliConfig, 'validateConfig');
const processExitSpy = vi.spyOn(process, 'exit');

describe('lib/middleware/configMiddleware', () => {
  beforeEach(() => {
    processExitSpy.mockImplementation(code => {
      throw new Error(`Process.exit called with code ${code}`);
    });
    getConfigPathSpy.mockReturnValue('/path/to/config');
  });

  describe('handleDeprecatedEnvVariables()', () => {
    it('should handle deprecated HUBSPOT_PORTAL_ID environment variable', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        HUBSPOT_PORTAL_ID: '123',
        HUBSPOT_ACCOUNT_ID: undefined,
      };

      const argv: Arguments<{ useEnv?: boolean }> = {
        _: ['some-command'],
        useEnv: true,
        $0: 'hs',
      };

      handleDeprecatedEnvVariables(argv);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'The HUBSPOT_PORTAL_ID environment variable is deprecated. Please use HUBSPOT_ACCOUNT_ID instead.'
        )
      );
      expect(process.env.HUBSPOT_ACCOUNT_ID).toBe('123');
      process.env = originalEnv;
    });

    it('should not handle HUBSPOT_PORTAL_ID if HUBSPOT_ACCOUNT_ID is set', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        HUBSPOT_PORTAL_ID: '123',
        HUBSPOT_ACCOUNT_ID: '456',
      };

      const argv: Arguments<{ useEnv?: boolean }> = {
        _: ['some-command'],
        useEnv: true,
        $0: 'hs',
      };

      handleDeprecatedEnvVariables(argv);

      expect(logger.log).not.toHaveBeenCalled();
      expect(process.env.HUBSPOT_ACCOUNT_ID).toBe('456');

      process.env = originalEnv;
    });
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
      expect(getAccountIdSpy).not.toHaveBeenCalled();

      process.env = originalEnv;
    });

    it('should use getAccountId when useEnv is false', async () => {
      getAccountIdSpy.mockReturnValue(456);

      const argv: Arguments<{ account?: string }> = {
        _: ['some-command'],
        account: 'test-account',
        useEnv: false,
        $0: 'hs',
      };

      await injectAccountIdMiddleware(argv);

      expect(argv.userProvidedAccount).toBe('test-account');
      expect(argv.derivedAccountId).toBe(456);
      expect(getAccountIdSpy).toHaveBeenCalledWith('test-account');
    });
  });

  describe('loadConfigMiddleware()', () => {
    it('should exit with error when config file exists and --config flag is used', async () => {
      configFileExistsSpy.mockReturnValue(true);

      const argv: Arguments = {
        _: ['some-command'],
        config: 'custom-config.json',
        $0: 'hs',
      };

      await expect(loadConfigMiddleware(argv)).rejects.toThrow();
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        'A configuration file already exists at /path/to/config. To specify a new configuration file, delete the existing one and try again.'
      );
    });

    it('should load config and validate for non-init commands', async () => {
      configFileExistsSpy.mockReturnValue(false);
      loadConfigSpy.mockReturnValue({} as CLIConfig);
      validateConfigSpy.mockReturnValue(true);

      const argv: Arguments = {
        _: ['some-command'],
        $0: 'hs',
      };

      await loadConfigMiddleware(argv);

      expect(loadConfigSpy).toHaveBeenCalled();
      expect(validateConfigSpy).toHaveBeenCalled();
    });

    it('should skip validation for init command', async () => {
      configFileExistsSpy.mockReturnValue(false);

      const argv: Arguments = {
        _: ['init'],
        $0: 'hs',
      };

      await loadConfigMiddleware(argv);

      expect(loadConfigSpy).not.toHaveBeenCalled();
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
