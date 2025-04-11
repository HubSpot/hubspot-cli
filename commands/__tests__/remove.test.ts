import yargs, { Argv } from 'yargs';
import * as commonOpts from '../../lib/commonOpts';
import * as removeCommand from '../remove';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/remove', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(removeCommand.command).toBe('remove <path>');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(removeCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      removeCommand.builder(yargs as Argv);

      expect(commonOpts.addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addGlobalOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addConfigOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addAccountOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the path positional argument', () => {
      removeCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith('path', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });
});
