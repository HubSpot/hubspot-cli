import yargs, { Argv } from 'yargs';
import clear from '../hubdb/clear.js';
import create from '../hubdb/create.js';
import deleteCommand from '../hubdb/delete.js';
import fetch from '../hubdb/fetch.js';
import list from '../hubdb/list.js';
import hubdbCommands from '../hubdb.js';

vi.mock('../hubdb/clear');
vi.mock('../hubdb/create');
vi.mock('../hubdb/delete');
vi.mock('../hubdb/fetch');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
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

    const subcommands = [clear, create, deleteCommand, fetch, list];

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
