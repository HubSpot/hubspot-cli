import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import * as projectUploadCommand from '../upload';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const optionsSpy = jest.spyOn(yargs as Argv, 'options');
const exampleSpy = jest.spyOn(yargs as Argv, 'example');

describe('commands/project/upload', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectUploadCommand.command).toEqual('upload');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectUploadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectUploadCommand.builder(yargs as Argv);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should define force-create, message, and skip-validation options', () => {
      projectUploadCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          'force-create': expect.any(Object),
          message: expect.any(Object),
          'skip-validation': expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });
});
