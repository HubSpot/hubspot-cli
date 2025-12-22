import yargs, { Argv } from 'yargs';
import createCommand from '../module/create.js';
import marketplaceValidateCommand from '../module/marketplace-validate.js';
import moduleCommands from '../module.js';

vi.mock('../module/create');
vi.mock('../module/marketplace-validate');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/cms/module', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(moduleCommands.command).toEqual('module');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(moduleCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [createCommand, marketplaceValidateCommand];

    it('should demand the command takes one positional argument', () => {
      moduleCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      moduleCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      moduleCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
