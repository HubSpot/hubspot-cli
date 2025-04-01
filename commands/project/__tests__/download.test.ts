import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import * as projectDownloadCommand from '../download';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const optionsSpy = jest.spyOn(yargs as Argv, 'options');
const exampleSpy = jest.spyOn(yargs as Argv, 'example');

describe('commands/project/download', () => {
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
      projectDownloadCommand.builder(yargs as Argv);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should define project, dest, and build options', () => {
      projectDownloadCommand.builder(yargs as Argv);

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
