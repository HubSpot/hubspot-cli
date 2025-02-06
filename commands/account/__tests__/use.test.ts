import yargs, { Argv } from 'yargs';

jest.mock('yargs');

// Import this last so mocks apply
import * as accountUseCommand from '../use';

describe('commands/account/use', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountUseCommand.command).toEqual('use [account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountUseCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountUseCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith('account', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });
});
