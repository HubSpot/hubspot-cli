import yargs, { Argv } from 'yargs';
import * as accountRemoveOverrideCommand from '../removeOverride';

jest.mock('yargs');

describe('commands/account/removeOverride', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      options: jest.fn().mockReturnThis(),
    } as unknown as Argv;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountRemoveOverrideCommand.command).toEqual('remove-override');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountRemoveOverrideCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountRemoveOverrideCommand.builder(yargsMock);

      expect(yargsMock.options).toHaveBeenCalledTimes(1);
    });
  });
});
