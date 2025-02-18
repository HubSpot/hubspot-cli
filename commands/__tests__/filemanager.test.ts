import yargs, { Argv } from 'yargs';
import * as fetch from '../filemanager/fetch';
import * as upload from '../filemanager/upload';
import * as fileManagerCommands from '../filemanager';

jest.mock('yargs');
jest.mock('../filemanager/fetch');
jest.mock('../filemanager/upload');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/filemanager', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fileManagerCommands.command).toEqual('filemanager');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fileManagerCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [fetch, upload];

    it('should demand the command takes one positional argument', () => {
      fileManagerCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      fileManagerCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      fileManagerCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
