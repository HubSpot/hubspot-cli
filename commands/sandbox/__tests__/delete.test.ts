import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

import * as sandboxDeleteCommand from '../delete';

describe('commands/sandbox/delete', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(sandboxDeleteCommand.command).toEqual('delete');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(sandboxDeleteCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      sandboxDeleteCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
