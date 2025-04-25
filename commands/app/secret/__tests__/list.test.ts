import yargs, { Argv } from 'yargs';
import listAppSecretsCommand from '../list';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/app/secret/list', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(listAppSecretsCommand.command).toEqual('list');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(listAppSecretsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      listAppSecretsCommand.builder(yargsMock);

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
