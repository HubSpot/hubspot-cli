import yargs, { Argv } from 'yargs';
import clear from '../hubdb/clear';
import create from '../hubdb/create';
import deleteCommand from '../hubdb/delete';
import fetch from '../hubdb/fetch';
import hubdbCommands from '../hubdb';

jest.mock('yargs');
jest.mock('../hubdb/clear');
jest.mock('../hubdb/create');
jest.mock('../hubdb/delete');
jest.mock('../hubdb/fetch');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/hubdb', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(hubdbCommands.command).toEqual('hubdb');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(hubdbCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [clear, create, deleteCommand, fetch];

    it('should demand the command takes one positional argument', () => {
      hubdbCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      hubdbCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      hubdbCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
