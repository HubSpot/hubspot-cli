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
      expect(yargs.positional).toHaveBeenCalledWith('type', {
        describe: 'Authentication mechanism',
        type: 'string',
        choices: ['personalaccesskey', 'oauth2'],
        default: 'personalaccesskey',
        defaultDescription:
          '"personalaccesskey": \nAn access token tied to a specific user account. This is the recommended way of authenticating with local development tools.',
      });
    });

    it('should support the correct options', () => {
      authCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        account: {
          describe: 'HubSpot account to authenticate',
          type: 'string',
        },
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
