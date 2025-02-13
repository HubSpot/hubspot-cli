import yargs, { Argv } from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as listSecretCommand from '../listSecret';

describe('commands/account/clean', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(listSecretCommand.command).toEqual('list');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(listSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      listSecretCommand.builder(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
