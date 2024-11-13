// @ts-nocheck
import yargs from 'yargs';
import { addConfigOptions, addTestingOptions } from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

// Import this last so mocks apply
import initCommand from '../init';

describe('commands/init', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(initCommand.command).toEqual('init [--account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(initCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      initCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        auth: expect.objectContaining({
          type: 'string',
          choices: ['personalaccesskey', 'oauth2'],
          default: 'personalaccesskey',
        }),
        account: expect.objectContaining({ type: 'string' }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
