import yargs, { Argv } from 'yargs';
import { addAccountOptions, addConfigOptions } from '../../../lib/commonOpts';
import * as themePreviewCommand from '../preview';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

describe('commands/theme/preview', () => {
  let yargsMock = yargs as Argv;

  beforeEach(() => {
    yargsMock = {
      option: jest.fn().mockReturnThis(),
    } as unknown as Argv;
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(themePreviewCommand.command).toEqual('preview [--src] [--dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(themePreviewCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      themePreviewCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);
    });
  });
});
