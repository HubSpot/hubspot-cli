import yargs, { Argv } from 'yargs';
import {
  addGlobalOptions,
  addConfigOptions,
  addAccountOptions,
  addOverwriteOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as fileManagerFetchCommand from '../fetch';

describe('commands/filemanager/fetch', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fileManagerFetchCommand.command).toEqual('fetch <src> [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fileManagerFetchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      fileManagerFetchCommand.builder(yargsMock);

      expect(addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(addGlobalOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addOverwriteOptions).toHaveBeenCalledTimes(1);
      expect(addOverwriteOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
