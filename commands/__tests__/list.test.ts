import yargs, { Argv } from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts.js';
import listCommand from '../list.js';

vi.mock('../../lib/commonOpts');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = vi
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/list', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(listCommand.command).toEqual(['list [path]', 'ls [path]']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(listCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      listCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith(
        'path',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      listCommand.builder(yargs as Argv);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should provide examples', () => {
      listCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });
});
