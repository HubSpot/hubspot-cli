import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
} from '../../../lib/commonOpts.js';
import projectListCommand from '../list.js';

vi.mock('../../../lib/commonOpts');

describe('commands/project/list', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectListCommand.command).toEqual(['list', 'ls']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectListCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectListCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define examples', () => {
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectListCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalled();
    });
  });
});
