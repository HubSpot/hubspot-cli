import yargs, { Argv } from 'yargs';
import list from '../function/list';
import deploy from '../function/deploy';
import server from '../function/server';
import functionCommands from '../function';

jest.mock('yargs');
jest.mock('../function/list');
jest.mock('../function/deploy');
jest.mock('../function/server');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

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
    const subcommands = [list, deploy, server];

    it('should demand the command takes one positional argument', () => {
      functionCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should support the correct options', () => {
      functionCommands.builder(yargs as Argv);
    });

    it('should add the correct number of sub commands', () => {
      functionCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      functionCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
