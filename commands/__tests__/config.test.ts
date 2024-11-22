// @ts-nocheck
import yargs from 'yargs';
import set from '../config/set';

jest.mock('yargs');
jest.mock('../config/set');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import configCommand from '../config';

describe('commands/config', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(configCommand.command).toEqual('config');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(configCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [['set', set]];

    it('should demand the command takes one positional argument', () => {
      configCommand.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      configCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      configCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
