import yargs, { Argv } from 'yargs';
import create from '../customObject/create';
import schema from '../customObject/schema';
import customObjectCommands from '../customObject';

jest.mock('yargs');
jest.mock('../customObject/create');
jest.mock('../customObject/schema');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/customObject', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(customObjectCommands.command).toEqual([
        'custom-object',
        'custom-objects',
        'co',
      ]);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(customObjectCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [create, schema];

    it('should demand the command takes one positional argument', () => {
      customObjectCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      customObjectCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      customObjectCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
