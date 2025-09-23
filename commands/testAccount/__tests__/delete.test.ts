import yargs, { Argv } from 'yargs';
import {
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../../lib/commonOpts.js';
import testAccountDeleteCommand from '../delete.js';

vi.mock('../../../lib/commonOpts');

describe('commands/testAccount/delete', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(testAccountDeleteCommand.command).toEqual('delete [test-account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(testAccountDeleteCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      testAccountDeleteCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
