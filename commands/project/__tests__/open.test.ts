import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../../lib/commonOpts';
import projectOpenCommand from '../open';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/project/open', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectOpenCommand.command).toEqual('open');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectOpenCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectOpenCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project option', () => {
      const optionsSpy = jest.spyOn(yargsMock, 'options');
      const exampleSpy = jest.spyOn(yargsMock, 'example');

      projectOpenCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });
});
