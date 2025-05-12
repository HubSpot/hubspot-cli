import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../../lib/commonOpts';
import schemaFetchCommand from '../fetch';

jest.mock('yargs');
jest.mock('../../../../lib/commonOpts');

describe('commands/customObject/schema/fetch', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      positional: jest.fn().mockReturnThis(),
      example: jest.fn().mockReturnThis(),
    } as unknown as Argv;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(schemaFetchCommand.command).toEqual('fetch [name] [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(schemaFetchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      schemaFetchCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledTimes(2);
      expect(yargsMock.positional).toHaveBeenCalledWith('name', {
        describe: expect.any(String),
        type: 'string',
      });
      expect(yargsMock.positional).toHaveBeenCalledWith('dest', {
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
