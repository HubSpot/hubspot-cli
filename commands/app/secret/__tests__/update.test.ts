import yargs, { Argv } from 'yargs';
import updateAppSecretCommand from '../update';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/app/secret/update', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(updateAppSecretCommand.command).toEqual('update');
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

      expect(yargsMock.example).toHaveBeenCalledTimes(2);
      expect(yargsMock.option).toHaveBeenCalledWith('app-id', {
        type: 'string',
        name: expect.objectContaining({
          type: 'string',
        }),
      });
    });
  });
});
