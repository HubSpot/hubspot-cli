import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
  addJSONOutputOptions,
} from '../../../lib/commonOpts.js';
import testAccountCreateCommand from '../create.js';

vi.mock('../../../lib/commonOpts');

describe('commands/testAccount/create', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(testAccountCreateCommand.command).toEqual('create');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(testAccountCreateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      testAccountCreateCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);

      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
