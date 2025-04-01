import yargs, { Argv } from 'yargs';
import { addGlobalOptions, addTestingOptions } from '../../../lib/commonOpts';
import * as accountAuthCommand from '../auth';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/account/auth', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountAuthCommand.command).toEqual('auth');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      // TODO: Change to defined when we unhide the command
      expect(accountAuthCommand.describe).toBeUndefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountAuthCommand.builder(yargsMock);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);

      expect(addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(addGlobalOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
