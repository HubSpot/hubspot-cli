import yargs, { Argv } from 'yargs';
import set from '../config/set';
import migrate from '../config/migrate';
import configCommands from '../config';

jest.mock('yargs');
jest.mock('../config/set');
jest.mock('../config/set');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/config', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(configCommands.command).toEqual('config');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(configCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [set, migrate];

    it('should demand the command takes one positional argument', () => {
      configCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      configCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      configCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
