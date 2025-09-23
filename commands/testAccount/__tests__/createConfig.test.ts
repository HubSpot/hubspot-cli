import yargs, { Argv } from 'yargs';
import testAccountCreateConfigCommand from '../createConfig.js';

vi.mock('../../../lib/commonOpts');

describe('commands/testAccount/createConfig', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(testAccountCreateConfigCommand.command).toEqual('create-config');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(testAccountCreateConfigCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      const optionSpy = vi.spyOn(yargsMock, 'option');

      testAccountCreateConfigCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);

      expect(optionSpy).toHaveBeenCalledWith(
        'name',
        expect.objectContaining({
          type: 'string',
        })
      );

      expect(optionSpy).toHaveBeenCalledWith(
        'description',
        expect.objectContaining({
          type: 'string',
        })
      );

      expect(optionSpy).toHaveBeenCalledWith(
        'path',
        expect.objectContaining({
          type: 'string',
        })
      );
    });
  });
});
