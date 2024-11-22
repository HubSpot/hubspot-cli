// @ts-nocheck
import yargs from 'yargs';
import list from '../accounts/list';
import rename from '../accounts/rename';
import use from '../accounts/use';
import info from '../accounts/info';
import remove from '../accounts/remove';
import clean from '../accounts/clean';

jest.mock('yargs');
jest.mock('../accounts/list');
jest.mock('../accounts/rename');
jest.mock('../accounts/use');
jest.mock('../accounts/info');
jest.mock('../accounts/remove');
jest.mock('../accounts/clean');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import accountsCommand from '../accounts';

describe('commands/accounts', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountsCommand.command).toEqual(['account', 'accounts']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountsCommand.describe).toBeDefined();
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
    ];

    it('should demand the command takes one positional argument', () => {
      accountsCommand.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      accountsCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      accountsCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
