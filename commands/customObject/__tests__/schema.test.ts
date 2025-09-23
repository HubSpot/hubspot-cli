import yargs, { Argv } from 'yargs';
import create from '../schema/create.js';
import deleteCommand from '../schema/delete.js';
import fetchAll from '../schema/fetch-all.js';
import fetch from '../schema/fetch.js';
import list from '../schema/list.js';
import update from '../schema/update.js';
import schemaCommands from '../schema.js';

vi.mock('../schema/create');
vi.mock('../schema/delete');
vi.mock('../schema/fetch-all');
vi.mock('../schema/fetch');
vi.mock('../schema/list');
vi.mock('../schema/update');
vi.mock('../../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/customObject/schema', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(schemaCommands.command).toEqual(['schema', 'schemas']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(schemaCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [create, deleteCommand, fetchAll, fetch, list, update];

    it('should demand the command takes one positional argument', () => {
      schemaCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      schemaCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      schemaCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
