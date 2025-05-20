import yargs, { Argv } from 'yargs';
import accountRemoveOverrideCommand from '../removeOverride';

jest.mock('yargs');

const optionsSpy = jest
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

describe('commands/account/removeOverride', () => {
  const yargsMock = yargs as Argv;

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

      expect(optionsSpy).toHaveBeenCalledTimes(1);
    });
  });
});
