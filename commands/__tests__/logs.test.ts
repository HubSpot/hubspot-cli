// @ts-nocheck
import yargs from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');
yargs.options.mockReturnValue(yargs);
yargs.conflicts.mockReturnValue(yargs);

// Import this last so mocks apply
import logsCommand from '../logs';

describe('commands/logs', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(logsCommand.command).toEqual('logs [endpoint]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(logsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      logsCommand.builder(yargs);

      expect(yargs.positional).toHaveBeenCalledTimes(1);
      expect(yargs.positional).toHaveBeenCalledWith(
        'endpoint',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      logsCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        latest: expect.objectContaining({
          alias: 'l',
          type: 'boolean',
        }),
        compact: expect.objectContaining({
          type: 'boolean',
        }),
        follow: expect.objectContaining({
          alias: ['t', 'tail', 'f'],
          type: 'boolean',
        }),
        limit: expect.objectContaining({
          alias: ['limit', 'n', 'max-count'],
          type: 'number',
        }),
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should set the correct conflicts', () => {
      logsCommand.builder(yargs);
      expect(yargs.conflicts).toHaveBeenCalledTimes(2);
      expect(yargs.conflicts).toHaveBeenCalledWith('follow', 'limit');
      expect(yargs.conflicts).toHaveBeenCalledWith('functionName', 'endpoint');
    });

    it('should provide examples', () => {
      logsCommand.builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
    });
  });
});
