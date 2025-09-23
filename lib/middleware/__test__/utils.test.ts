import { isTargetedCommand } from '../utils.js';

const targetCommandMap = {
  init: { target: true },
  account: {
    target: true,
    subCommands: {
      use: { target: true },
    },
  },
  project: {
    subCommands: {
      deploy: { target: true },
    },
  },
};

describe('lib/middleware/utils', () => {
  describe('isTargetedCommand()', () => {
    it('should return true for a direct target command', () => {
      const result = isTargetedCommand(['init'], targetCommandMap);
      expect(result).toBe(true);
    });

    it('should return true for a command with a subcommand', () => {
      const result = isTargetedCommand(['account'], targetCommandMap);
      expect(result).toBe(true);
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
});
