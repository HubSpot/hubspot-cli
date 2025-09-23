import yargs, { Argv } from 'yargs';
import auth from '../account/auth.js';
import list from '../account/list.js';
import rename from '../account/rename.js';
import use from '../account/use.js';
import info from '../account/info.js';
import remove from '../account/remove.js';
import clean from '../account/clean.js';
import createOverride from '../account/createOverride.js';
import removeOverride from '../account/removeOverride.js';
import accountCommands from '../account.js';

vi.mock('../account/auth');
vi.mock('../account/list');
vi.mock('../account/rename');
vi.mock('../account/use');
vi.mock('../account/info');
vi.mock('../account/remove');
vi.mock('../account/clean');
vi.mock('../account/createOverride');
vi.mock('../account/removeOverride');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
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
