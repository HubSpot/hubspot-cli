// @ts-nocheck
import yargs from 'yargs';
import { addConfigOptions, addTestingOptions } from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

// Import this last so mocks apply
import authCommand from '../auth';

describe('commands/auth', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(authCommand.command).toEqual('auth [type] [--account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(authCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      authCommand.builder(yargs);

      expect(yargs.positional).toHaveBeenCalledTimes(1);
      expect(yargs.positional).toHaveBeenCalledWith(
        'type',
        expect.objectContaining({
          type: 'string',
          choices: ['personalaccesskey', 'oauth2'],
          default: 'personalaccesskey',
        })
      );
    });

    it('should support the correct options', () => {
      authCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        account: expect.objectContaining({ type: 'string' }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
