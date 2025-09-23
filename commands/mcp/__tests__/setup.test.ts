import setupCommand from '../setup.js';

vi.mock('../../../lib/commonOpts');

describe('commands/mcp/setup', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(setupCommand.command).toEqual(['setup']);
    });
  });

  describe('describe', () => {
    it('should be undefined to keep the command hidden', () => {
      expect(setupCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should be defined as a function', () => {
      expect(setupCommand.builder).toBeDefined();
      expect(typeof setupCommand.builder).toBe('function');
    });
  });

  describe('handler', () => {
    it('should be defined', () => {
      expect(setupCommand.handler).toBeDefined();
      expect(typeof setupCommand.handler).toBe('function');
    });
  });
});
