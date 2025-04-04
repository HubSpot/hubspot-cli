import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import * as projectDownloadCommand from '../download';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/project/download', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectDownloadCommand.command).toEqual('download');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectDownloadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectDownloadCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project, dest, and build options', () => {
      const optionsSpy = jest.spyOn(yargsMock, 'options');
      const exampleSpy = jest.spyOn(yargsMock, 'example');

      projectDownloadCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
          dest: expect.any(Object),
          build: expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });
});
