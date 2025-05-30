import yargs, { Argv } from 'yargs';
import add from '../profile/add';
import deleteProfile from '../profile/delete';
import profileCommand from '../profile';

jest.mock('yargs');
jest.mock('../profile/add');
jest.mock('../profile/delete');
jest.mock('../../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/project', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(profileCommand.command).toEqual(['profile', 'profiles']);
    });
  });

  describe('describe', () => {
    it('should not provide a description', () => {
      expect(profileCommand.describe).not.toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [add, deleteProfile];

    it('should demand the command takes one positional argument', () => {
      profileCommand.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      profileCommand.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      profileCommand.builder(yargs as Argv);
      expect(module).toBeDefined();
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
