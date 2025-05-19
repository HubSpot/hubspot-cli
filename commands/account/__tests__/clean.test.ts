import yargs, { Argv } from 'yargs';
import { addConfigOptions } from '../../../lib/commonOpts';
import { addTestingOptions } from '../../../lib/commonOpts';
import accountCleanCommand from '../clean';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/account/clean', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountCleanCommand.command).toEqual('clean');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountCleanCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountCleanCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addTestingOptions).toHaveBeenCalledTimes(1);
      expect(addTestingOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
