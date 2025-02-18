import yargs, { Argv } from 'yargs';
import {
  addGlobalOptions,
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as fileManagerUploadCommand from '../upload';

describe('commands/filemanager/upload', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fileManagerUploadCommand.command).toEqual('upload <src> <dest>');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fileManagerUploadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      fileManagerUploadCommand.builder(yargsMock);

      expect(addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(addGlobalOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
