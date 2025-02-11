import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as hubdbFetchCommand from '../fetch';

describe('commands/hubdb/fetch', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(hubdbFetchCommand.command).toEqual('fetch [table-id] [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(hubdbFetchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      hubdbFetchCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
