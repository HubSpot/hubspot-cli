// @ts-nocheck
import yargs from 'yargs';
import upload from '../filemanager/upload';
import fetch from '../filemanager/fetch';

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
