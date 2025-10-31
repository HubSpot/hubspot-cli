import yargs, { Argv } from 'yargs';
import create from '../customObject/create.js';
import schema from '../customObject/schema.js';
import createSchema from '../customObject/createSchema.js';
import updateSchema from '../customObject/updateSchema.js';
import listSchemas from '../customObject/listSchemas.js';
import deleteSchema from '../customObject/deleteSchema.js';
import fetchSchema from '../customObject/fetchSchema.js';
import fetchAllSchemas from '../customObject/fetchAllSchemas.js';
import customObjectCommands from '../customObject.js';

vi.mock('../customObject/create');
vi.mock('../customObject/schema');
vi.mock('../customObject/createSchema');
vi.mock('../customObject/updateSchema');
vi.mock('../customObject/listSchemas');
vi.mock('../customObject/deleteSchema');
vi.mock('../customObject/fetchSchema');
vi.mock('../customObject/fetchAllSchemas');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
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

    const subcommands = [
      create,
      schema,
      createSchema,
      updateSchema,
      listSchemas,
      deleteSchema,
      fetchSchema,
      fetchAllSchemas,
    ];

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
