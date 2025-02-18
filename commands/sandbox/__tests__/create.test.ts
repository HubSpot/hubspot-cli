import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

import * as sandboxCreateCommand from '../create';

describe('commands/sandbox/create', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(sandboxCreateCommand.command).toEqual('create');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(sandboxCreateCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      sandboxCreateCommand.builder(yargsMock);

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
