import yargs, { Argv } from 'yargs';
import { addConfigOptions } from '../../../lib/commonOpts';
import accountRemoveCommand from '../remove';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const positionalSpy = jest
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);
const exampleSpy = jest
  .spyOn(yargs as Argv, 'example')
  .mockReturnValue(yargs as Argv);

describe('commands/account/remove', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(accountRemoveCommand.command).toEqual('remove [account]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(accountRemoveCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      accountRemoveCommand.builder(yargsMock);

      expect(exampleSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledTimes(1);
      expect(positionalSpy).toHaveBeenCalledWith('account', {
        describe: expect.any(String),
        type: 'string',
      });

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
