import yargs, { Argv } from 'yargs';
import { addConfigOptions } from '../../../lib/commonOpts';
import accountListCommand from '../list';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

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

      expect(exampleSpy).toHaveBeenCalledTimes(1);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
