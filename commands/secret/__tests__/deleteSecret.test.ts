import yargs, { Argv } from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as deleteSecretCommand from '../deleteSecret';

describe('commands/account/clean', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      positional: jest.fn().mockReturnThis(),
      options: jest.fn().mockReturnThis(),
      command: jest.fn().mockReturnThis(),
      demandCommand: jest.fn().mockReturnThis(),
      help: jest.fn().mockReturnThis(),
      alias: jest.fn().mockReturnThis(),
      argv: {},
    } as unknown as Argv;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(deleteSecretCommand.command).toEqual('delete [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(deleteSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      deleteSecretCommand.builder(yargsMock);

      expect(yargsMock.positional).toHaveBeenCalledTimes(1);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
