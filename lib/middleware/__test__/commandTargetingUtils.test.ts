import * as cliConfig from '@hubspot/local-dev-lib/config';
import {
  isTargetedCommand,
  shouldLoadConfigForCommand,
  shouldRunAccountValidationForCommand,
  shouldRunConfigValidationForCommand,
} from '../commandTargetingUtils.js';

vi.mock('@hubspot/local-dev-lib/config');

const configFileExistsSpy = vi.spyOn(cliConfig, 'configFileExists');

const targetCommandMap = {
  init: true,
  account: {
    use: true,
  },
  project: {
    deploy: true,
  },
};

describe('lib/middleware/commandTargetingUtils', () => {
  describe('isTargetedCommand()', () => {
    it('should return true for a direct target command', () => {
      const result = isTargetedCommand(['init'], targetCommandMap);
      expect(result).toBe(true);
    });

    it('should return false for a command with a subcommand', () => {
      const result = isTargetedCommand(['account'], targetCommandMap);
      expect(result).toBe(false);
    });

    it('should return true for a nested target command', () => {
      const result = isTargetedCommand(['project', 'deploy'], targetCommandMap);
      expect(result).toBe(true);
    });

    it('should return false for a non-existent command', () => {
      const result = isTargetedCommand(['nonexistent'], targetCommandMap);
      expect(result).toBe(false);
    });

    it('should return false for a non-targeted command', () => {
      const result = isTargetedCommand(['auth'], targetCommandMap);
      expect(result).toBe(false);
    });

    it('should return false for a command with a targeted subcommand', () => {
      const result = isTargetedCommand(['project'], targetCommandMap);
      expect(result).toBe(false);
    });

    it('should return false for a non-existent subcommand', () => {
      const result = isTargetedCommand(
        ['auth', 'nonexistent'],
        targetCommandMap
      );
      expect(result).toBe(false);
    });

    it('should return false for an empty command array', () => {
      const result = isTargetedCommand([], targetCommandMap);
      expect(result).toBe(false);
    });
  });

  describe('shouldLoadConfigForCommand()', () => {
    it('should return true for a command that requires a config file', () => {
      const result = shouldLoadConfigForCommand(['account', 'use']);
      expect(result).toBe(true);
    });

    it('should return false for a command that does not require a config file', () => {
      const result = shouldLoadConfigForCommand(['init']);
      expect(result).toBe(false);
    });

    it('should return false when the user is trying to migrate the global config', () => {
      configFileExistsSpy.mockReturnValue(false);

      const result = shouldLoadConfigForCommand(['config', 'migrate']);
      expect(result).toBe(false);
    });

    it('should return true when the global config file does exist', () => {
      configFileExistsSpy.mockReturnValue(true);

      const result = shouldLoadConfigForCommand(['account', 'use']);
      expect(result).toBe(true);
    });
  });

  describe('shouldRunAccountValidationForCommand()', () => {
    it('should return true for a command that requires a config file', () => {
      const result = shouldRunAccountValidationForCommand([
        'project',
        'upload',
      ]);
      expect(result).toBe(true);
    });

    it('should return false for a command that does not require account validation', () => {
      const result1 = shouldRunAccountValidationForCommand(['init']);
      const result2 = shouldRunAccountValidationForCommand(['auth']);
      const result3 = shouldRunAccountValidationForCommand([
        'accounts',
        'list',
      ]);
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('shouldRunConfigValidationForCommand()', () => {
    it('should return true for a command that requires a config file', () => {
      const result = shouldRunConfigValidationForCommand(['account', 'use']);
      expect(result).toBe(true);
    });

    it('should return false for a command that does not require config validation', () => {
      const result = shouldRunConfigValidationForCommand(['init']);
      expect(result).toBe(false);
    });
  });
});
