import yargs, { Argv } from 'yargs';
import auth from '../account/auth';
import list from '../account/list';
import rename from '../account/rename';
import use from '../account/use';
import info from '../account/info';
import remove from '../account/remove';
import clean from '../account/clean';
import createOverride from '../account/createOverride';
import removeOverride from '../account/removeOverride';
import accountCommands from '../account';

jest.mock('yargs');
jest.mock('../account/auth');
jest.mock('../account/list');
jest.mock('../account/rename');
jest.mock('../account/use');
jest.mock('../account/info');
jest.mock('../account/remove');
jest.mock('../account/clean');
jest.mock('../account/createOverride');
jest.mock('../account/removeOverride');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/account', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountCommands.command).toEqual(['account', 'accounts']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [
      auth,
      list,
      rename,
      use,
      info,
      remove,
      clean,
      createOverride,
      removeOverride,
    ];

    it('should demand the command takes one positional argument', () => {
      accountCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      accountCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      accountCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
