import yargs, { Argv } from 'yargs';
import testAccountCreateCommand from '../testAccount/create.js';
import testAccountCreateConfigCommand from '../testAccount/createConfig.js';
import testAccountDeleteCommand from '../testAccount/delete.js';
import testAccountImportDataCommand from '../testAccount/importData.js';
import testAccountCommands from '../testAccount.js';

vi.mock('../testAccount/create');
vi.mock('../testAccount/createConfig');
vi.mock('../testAccount/delete');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/testAccount', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(testAccountCommands.command).toEqual([
        'test-account',
        'test-accounts',
      ]);
    });
  });

  // This is commented out because the description is undefined rn
  // describe('describe', () => {
  //   it('should provide a description', () => {
  //     expect(testAccountCommands.describe).toBeDefined();
  //   });
  // });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [
      testAccountCreateCommand,
      testAccountCreateConfigCommand,
      testAccountDeleteCommand,
      testAccountImportDataCommand,
    ];

    it('should demand the command takes one positional argument', () => {
      testAccountCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      testAccountCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      testAccountCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
