import yargs, { Argv } from 'yargs';
import preview from '../theme/preview.js';
import generateSelectors from '../theme/generate-selectors.js';
import marketplaceValidate from '../theme/marketplace-validate.js';
import create from '../theme/create.js';
import themeCommands from '../theme.js';

vi.mock('../theme/preview');
vi.mock('../theme/generate-selectors');
vi.mock('../theme/marketplace-validate');
vi.mock('../theme/create');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/cms/theme', () => {
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

    const subcommands = [
      preview,
      generateSelectors,
      marketplaceValidate,
      create,
    ];

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
