import yargs, { Argv } from 'yargs';
import { addConfigOptions } from '../../../lib/commonOpts.js';
import accountInfoCommand from '../info.js';

vi.mock('../../../lib/commonOpts');

const exampleSpy = vi
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
