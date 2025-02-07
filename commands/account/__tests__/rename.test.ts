import yargs, { Argv } from 'yargs';
import { addConfigOptions, addAccountOptions } from '../../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

// Import this last so mocks apply
import * as accountRenameCommand from '../rename';

describe('commands/account/rename', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountRenameCommand.command).toEqual(
        'rename <accountName> <newName>'
      );
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountRenameCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountRenameCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledTimes(2);
      expect(yargsMock.positional).toHaveBeenCalledWith('accountName', {
        describe: expect.any(String),
        type: 'string',
      });
      expect(yargsMock.positional).toHaveBeenCalledWith('newName', {
        describe: expect.any(String),
        type: 'string',
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
