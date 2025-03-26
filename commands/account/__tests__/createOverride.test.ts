import yargs, { Argv } from 'yargs';

jest.mock('yargs');

// Import this last so mocks apply
import * as accountCreateOverrideCommand from '../createOverride';

describe('commands/account/use', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountCreateOverrideCommand.command).toEqual(
        'create-override [account]'
      );
    });
  });

  describe('describe', () => {
    it('should not provide a description while in internal testing', () => {
      // TODO: Change this when we release the global config work
      expect(accountCreateOverrideCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountCreateOverrideCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith('account', {
        describe: expect.any(String),
        type: 'string',
      });
    });
  });
});
