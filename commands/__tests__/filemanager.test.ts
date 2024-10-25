// @ts-nocheck
import yargs from 'yargs';
import upload from '../filemanager/upload';
import fetch from '../filemanager/fetch';
import {
  addAccountOptions,
  addConfigOptions,
  addOverwriteOptions,
} from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../filemanager/upload');
jest.mock('../filemanager/fetch');
jest.mock('../../lib/commonOpts');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import filemanagerCommand from '../filemanager';

describe('commands/filemanager', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(filemanagerCommand.command).toEqual('filemanager');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(filemanagerCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [
      ['upload', upload],
      ['fetch', fetch],
    ];

    it('should demand the command takes one positional argument', () => {
      filemanagerCommand.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should support the correct options', () => {
      filemanagerCommand.builder(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(addOverwriteOptions).toHaveBeenCalledTimes(1);
      expect(addOverwriteOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the correct number of sub commands', () => {
      filemanagerCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      filemanagerCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
