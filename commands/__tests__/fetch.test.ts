// @ts-nocheck
import yargs from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addOverwriteOptions,
  addCmsPublishModeOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

// Import this last so mocks apply
import fetchCommand from '../fetch';

describe('commands/fetch', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fetchCommand.command).toEqual('fetch <src> [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fetchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      fetchCommand.builder(yargs);

      expect(yargs.positional).toHaveBeenCalledTimes(2);
      expect(yargs.positional).toHaveBeenCalledWith(
        'src',
        expect.objectContaining({ type: 'string' })
      );
      expect(yargs.positional).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      fetchCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(2);
      expect(yargs.options).toHaveBeenCalledWith({
        staging: expect.objectContaining({
          type: 'boolean',
          default: false,
          hidden: true,
        }),
      });
      expect(yargs.options).toHaveBeenCalledWith({
        assetVersion: expect.objectContaining({ type: 'number' }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addOverwriteOptions).toHaveBeenCalledTimes(1);
      expect(addOverwriteOptions).toHaveBeenCalledWith(yargs);

      expect(addCmsPublishModeOptions).toHaveBeenCalledTimes(1);
      expect(addCmsPublishModeOptions).toHaveBeenCalledWith(yargs, {
        read: true,
      });

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
