import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import schemaDeleteCommand from '../deleteSchema.js';

vi.mock('yargs');
vi.mock('../../../lib/commonOpts');

describe('commands/customObject/deleteSchema', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      positional: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      example: vi.fn().mockReturnThis(),
    } as unknown as Argv;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(schemaDeleteCommand.command).toEqual('delete-schema [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(schemaDeleteCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      schemaDeleteCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith('name', {
        describe: expect.any(String),
        type: 'string',
      });

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
