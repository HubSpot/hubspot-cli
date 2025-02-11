import yargs, { Argv } from 'yargs';
import * as create from '../sandbox/create';
import * as del from '../sandbox/delete';

jest.mock('yargs');
jest.mock('../sandbox/create');
jest.mock('../sandbox/delete');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

// Import this last so mocks apply
import * as sandboxCommands from '../sandbox';

describe('commands/account', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(sandboxCommands.command).toEqual(['sandbox', 'sandboxes']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(sandboxCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [create, del];

    it('should demand the command takes one positional argument', () => {
      sandboxCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      sandboxCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      sandboxCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
