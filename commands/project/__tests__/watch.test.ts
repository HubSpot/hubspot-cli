import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import * as projectWatchCommand from '../watch';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/project/watch', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectWatchCommand.command).toEqual('watch');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectWatchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectWatchCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define options', () => {
      const optionSpy = jest.spyOn(yargsMock, 'option');
      const exampleSpy = jest.spyOn(yargsMock, 'example');

      projectWatchCommand.builder(yargsMock);

      expect(optionSpy).toHaveBeenCalledWith(
        'initial-upload',
        expect.any(Object)
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });
});
