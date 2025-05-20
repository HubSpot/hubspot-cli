import yargs, { Argv } from 'yargs';
import { addConfigOptions } from '../../../lib/commonOpts';
import accountInfoCommand from '../info';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/info', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountInfoCommand.command).toEqual('info [account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountInfoCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountInfoCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
