import yargs, { Argv } from 'yargs';
import * as addSecret from '../secret/addSecret';
import * as deleteSecret from '../secret/deleteSecret';
import * as listSecret from '../secret/listSecret';
import * as updateSecret from '../secret/updateSecret';

jest.mock('yargs');
jest.mock('../secret/addSecret');
jest.mock('../secret/deleteSecret');
jest.mock('../secret/listSecret');
jest.mock('../secret/updateSecret');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

// Import this last so mocks apply
import * as secretCommands from '../secret';

describe('commands/account', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(secretCommands.command).toEqual(['secret', 'secrets']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(secretCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [addSecret, deleteSecret, listSecret, updateSecret];

    it('should demand the command takes one positional argument', () => {
      secretCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      secretCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      secretCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
