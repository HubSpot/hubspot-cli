import yargs, { Argv } from 'yargs';
import { addConfigOptions, addAccountOptions } from '../../lib/commonOpts';
import lintCommand from '../lint';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/lint', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(lintCommand.command).toEqual('lint <path>');
    });
  });

  describe('describe', () => {
    it('should not provide a description', () => {
      expect(lintCommand.describe).toEqual(undefined);
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      lintCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith(
        'path',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      lintCommand.builder(yargs as Argv);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
