import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addJSONOutputOptions,
} from '../../../lib/commonOpts.js';
import projectUploadCommand from '../upload.js';

vi.mock('../../../lib/commonOpts');

const optionsSpy = vi.spyOn(yargs as Argv, 'options');
const exampleSpy = vi.spyOn(yargs as Argv, 'example');
const conflictsSpy = vi.spyOn(yargs as Argv, 'conflicts');

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

      expect(conflictsSpy).toHaveBeenCalledTimes(1);
      expect(conflictsSpy).toHaveBeenCalledWith('profile', 'account');

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);

      expect(addJSONOutputOptions).toHaveBeenCalledTimes(1);
      expect(addJSONOutputOptions).toHaveBeenCalledWith(yargs);
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
