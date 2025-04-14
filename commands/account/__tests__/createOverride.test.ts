import yargs, { Argv } from 'yargs';
import * as accountCreateOverrideCommand from '../createOverride';

jest.mock('yargs');

describe('commands/account/createOverride', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountCreateOverrideCommand.command).toEqual(
        'create-override [account]'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountCreateOverrideCommand.describe).toBeDefined();
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
