import yargs, { Argv } from 'yargs';
import updateAppSecretCommand from '../update';

jest.mock('yargs');
jest.mock('../../../../lib/commonOpts');

describe('commands/app/secret/update', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(updateAppSecretCommand.command).toEqual('update [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(updateAppSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      updateAppSecretCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.positional).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({
          type: 'string',
        })
      );
      expect(yargsMock.option).toHaveBeenCalledWith(
        'app',
        expect.objectContaining({
          type: 'number',
        })
      );
    });
  });
});
