// @ts-nocheck
import yargs from 'yargs';
import { addConfigOptions, addAccountOptions } from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

// Import this last so mocks apply
import lintCommand from '../lint';

describe('commands/lint', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(lintCommand.command).toEqual('lint <path>');
    });
  });

  describe('describe', () => {
    it('should not provide a description', () => {
      expect(lintCommand.describe).toEqual(null);
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      lintCommand.builder(yargs);

      expect(yargs.positional).toHaveBeenCalledTimes(1);
      expect(yargs.positional).toHaveBeenCalledWith(
        'path',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      lintCommand.builder(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
