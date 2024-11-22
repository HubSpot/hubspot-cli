// @ts-nocheck
import yargs from 'yargs';
import list from '../function/list';
import deploy from '../function/deploy';
import server from '../function/server';

jest.mock('yargs');
jest.mock('../function/list');
jest.mock('../function/deploy');
jest.mock('../function/server');
jest.mock('../../lib/commonOpts');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import functionCommands from '../function';

describe('commands/function', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(functionCommands.command).toEqual(['function', 'functions']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(functionCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [
      ['list', list],
      ['deploy', deploy],
      ['server', server],
    ];

    it('should demand the command takes one positional argument', () => {
      functionCommands.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should support the correct options', () => {
      functionCommands.builder(yargs);
    });

    it('should add the correct number of sub commands', () => {
      functionCommands.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      functionCommands.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
