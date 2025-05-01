import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import projectListBuildsCommand from '../listBuilds';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/project/listBuilds', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectListBuildsCommand.command).toEqual('list-builds');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectListBuildsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectListBuildsCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project and limit options', () => {
      const optionsSpy = jest.spyOn(yargsMock, 'options');
      const exampleSpy = jest.spyOn(yargsMock, 'example');

      projectListBuildsCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
          limit: expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });
});
