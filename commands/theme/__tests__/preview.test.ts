import yargs, { Argv } from 'yargs';
import { addAccountOptions, addConfigOptions } from '../../../lib/commonOpts';
import themePreviewCommand from '../preview';

jest.mock('yargs');
jest.mock('../../../lib/commonOpts');

const optionSpy = jest
  .spyOn(yargs as Argv, 'option')
  .mockReturnValue(yargs as Argv);

describe('commands/theme/preview', () => {
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
      themePreviewCommand.builder(yargs as Argv);

      expect(optionSpy).toHaveBeenCalledWith('src', {
        describe: expect.any(String),
        type: 'string',
        requiresArg: true,
      });

      expect(optionSpy).toHaveBeenCalledWith('dest', {
        describe: expect.any(String),
        type: 'string',
        requiresArg: true,
      });

      expect(optionSpy).toHaveBeenCalledWith('notify', {
        describe: expect.any(String),
        alias: 'n',
        type: 'string',
        requiresArg: true,
      });

      expect(optionSpy).toHaveBeenCalledWith('no-ssl', {
        describe: expect.any(String),
        type: 'boolean',
      });

      expect(optionSpy).toHaveBeenCalledWith('port', {
        describe: expect.any(String),
        type: 'number',
      });

      expect(optionSpy).toHaveBeenCalledWith('resetSession', {
        hidden: true,
        type: 'boolean',
      });

      expect(optionSpy).toHaveBeenCalledWith('generateFieldsTypes', {
        hidden: true,
        type: 'boolean',
      });

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
