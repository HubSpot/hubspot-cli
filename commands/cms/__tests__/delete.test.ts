import yargs, { Argv } from 'yargs';
import * as commonOpts from '../../../lib/commonOpts.js';
import deleteCommand from '../delete.js';

vi.mock('../../../lib/commonOpts');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/cms/delete', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(deleteCommand.command).toBe('delete <path>');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(deleteCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      deleteCommand.builder(yargs as Argv);

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
      deleteCommand.builder(yargs as Argv);
      expect(positionalSpy).toHaveBeenCalledWith('path', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });
});
