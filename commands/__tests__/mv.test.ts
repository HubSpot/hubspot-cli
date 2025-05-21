import yargs, { Argv } from 'yargs';
import * as commonOpts from '../../lib/commonOpts';
import mvCommand from '../mv';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/mv', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(mvCommand.command).toBe('mv <srcPath> <destPath>');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(mvCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      mvCommand.builder(yargs as Argv);

      expect(commonOpts.addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addGlobalOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addConfigOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addAccountOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the srcPath positional argument', () => {
      mvCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith('srcPath', {
        describe: 'Remote hubspot path',
        type: 'string',
      });
    });

    it('should add the destPath positional argument', () => {
      mvCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith('destPath', {
        describe: 'Remote hubspot path',
        type: 'string',
      });
    });
  });
});
