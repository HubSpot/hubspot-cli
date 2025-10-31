import yargs, { Argv } from 'yargs';
import list from '../function/list.js';
import deploy from '../function/deploy.js';
import server from '../function/server.js';
import logs from '../function/logs.js';
import create from '../function/create.js';
import functionCommands from '../function.js';

vi.mock('../function/list');
vi.mock('../function/deploy');
vi.mock('../function/server');
vi.mock('../function/logs');
vi.mock('../function/create');
vi.mock('../../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/cms/function', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(functionCommands.command).toEqual(['function', 'functions']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(functionCommands.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [list, deploy, server, logs, create];

    it('should demand the command takes one positional argument', () => {
      functionCommands.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should support the correct options', () => {
      functionCommands.builder(yargs as Argv);
    });

    it('should add the correct number of sub commands', () => {
      functionCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      functionCommands.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
