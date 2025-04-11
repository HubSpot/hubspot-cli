import yargs, { Argv } from 'yargs';
import * as projectAddCommand from '../add';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/project/add', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectAddCommand.command).toEqual('add');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectAddCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectAddCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(2);
      expect(yargsMock.options).toHaveBeenCalledWith({
        type: expect.objectContaining({ type: 'string' }),
        name: expect.objectContaining({
          type: 'string',
        }),
      });
    });
  });
});
