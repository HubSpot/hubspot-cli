import yargs, { Argv } from 'yargs';
import * as create from '../schema/create';
import * as deleteCommand from '../schema/delete';
import * as fetchAll from '../schema/fetch-all';
import * as fetch from '../schema/fetch';
import * as list from '../schema/list';
import * as update from '../schema/update';
import * as schemaCommands from '../schema';

jest.mock('yargs');
jest.mock('../schema/create');
jest.mock('../schema/delete');
jest.mock('../schema/fetch-all');
jest.mock('../schema/fetch');
jest.mock('../schema/list');
jest.mock('../schema/update');
jest.mock('../../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
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
