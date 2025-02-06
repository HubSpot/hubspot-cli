import yargs, { Argv } from 'yargs';
import { addConfigOptions } from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as accountListCommand from '../list';

describe('commands/account/list', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountListCommand.command).toEqual(['list', 'ls']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountListCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountListCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
