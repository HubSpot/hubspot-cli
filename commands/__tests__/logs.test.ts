import yargs, { Argv } from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

const optionsSpy = jest
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

const conflictsSpy = jest
  .spyOn(yargs as Argv, 'conflicts')
  .mockReturnValue(yargs as Argv);

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

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        latest: expect.objectContaining({
          alias: 'l',
          type: 'boolean',
        }),
        compact: expect.objectContaining({
          type: 'boolean',
        }),
        follow: expect.objectContaining({
          alias: ['f'],
          type: 'boolean',
        }),
        limit: expect.objectContaining({
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
      expect(conflictsSpy).toHaveBeenCalledTimes(1);
      expect(conflictsSpy).toHaveBeenCalledWith('follow', 'limit');
    });

    it('should provide examples', () => {
      logsCommand.builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
    });
  });
});
