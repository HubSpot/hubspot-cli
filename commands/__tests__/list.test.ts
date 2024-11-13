// @ts-nocheck
import yargs from 'yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../lib/commonOpts');

// Import this last so mocks apply
import listCommand from '../list';

describe('commands/list', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(listCommand.command).toEqual('list [path]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(listCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      listCommand.builder(yargs);

      expect(yargs.positional).toHaveBeenCalledTimes(1);
      expect(yargs.positional).toHaveBeenCalledWith(
        'path',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      listCommand.builder(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should provide examples', () => {
      listCommand.builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
    });
  });
});
