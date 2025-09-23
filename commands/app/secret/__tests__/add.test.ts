import yargs, { Argv } from 'yargs';
import addAppSecretCommand from '../add.js';

vi.mock('../../../../lib/commonOpts');

describe('commands/app/secret/add', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(addAppSecretCommand.command).toEqual('add [name]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(addAppSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      addAppSecretCommand.builder(yargsMock);

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
