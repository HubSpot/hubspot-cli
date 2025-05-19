import yargs, { Argv } from 'yargs';
import { addConfigOptions, addAccountOptions } from '../../../lib/commonOpts';
import accountRenameCommand from '../rename';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/rename', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountRenameCommand.command).toEqual(
        'rename <account-name> <new-name>'
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

      expect(exampleSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledTimes(2);
      expect(positionalSpy).toHaveBeenCalledWith('account-name', {
        describe: expect.any(String),
        type: 'string',
      });
      expect(positionalSpy).toHaveBeenCalledWith('new-name', {
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
