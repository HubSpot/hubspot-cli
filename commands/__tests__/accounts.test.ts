// @ts-nocheck
import yargs from 'yargs';
import list from '../account/list';
import rename from '../account/rename';
import use from '../account/use';
import * as info from '../account/info';
import remove from '../account/remove';
import clean from '../account/clean';
import * as createOverride from '../account/createOverride';

jest.mock('yargs');
jest.mock('../account/list');
jest.mock('../account/rename');
jest.mock('../account/use');
jest.mock('../account/info');
jest.mock('../account/remove');
jest.mock('../account/clean');
jest.mock('../account/createOverride');
jest.mock('../../lib/commonOpts');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import accountCommands from '../account';

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
    const subcommands = [
      ['list', list],
      ['rename', rename],
      ['use', use],
      ['info', info],
      ['remove', remove],
      ['clean', clean],
      ['createOverride', createOverride],
    ];

    it('should demand the command takes one positional argument', () => {
      accountCommands.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      accountCommands.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      accountCommands.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
