import yargs, { Argv } from 'yargs';
import deleteAppSecretCommand from '../delete';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/app/secret/delete', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(deleteAppSecretCommand.command).toEqual('delete');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(deleteAppSecretCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      deleteAppSecretCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(2);
      expect(yargsMock.positional).toHaveBeenCalledWith('name', {
        type: 'string',
        name: expect.objectContaining({
          type: 'string',
        }),
      });
      expect(yargsMock.option).toHaveBeenCalledWith('app-id', {
        type: 'string',
        name: expect.objectContaining({
          type: 'string',
        }),
      });
    });
  });
});
