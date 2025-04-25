import yargs, { Argv } from 'yargs';
import addAppSecretCommand from '../add';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/app/secret/add', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(addAppSecretCommand.command).toEqual('add');
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
