import yargs, { Argv } from 'yargs';
import * as preview from '../theme/preview';
import * as generateSelectors from '../theme/generate-selectors';
import * as marketplaceValidate from '../theme/marketplace-validate';
import * as themeCommands from '../theme';

jest.mock('yargs');
jest.mock('../theme/preview');
jest.mock('../theme/generate-selectors');
jest.mock('../theme/marketplace-validate');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/theme', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(themeCommands.command).toEqual(['theme', 'themes']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(themeCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [preview, generateSelectors, marketplaceValidate];

    it('should demand the command takes one positional argument', () => {
      themeCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      themeCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      themeCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
