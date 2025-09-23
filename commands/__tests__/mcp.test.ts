import yargs, { Argv } from 'yargs';
import startCommand from '../mcp/start.js';
import setupCommand from '../mcp/setup.js';
import mcpCommand from '../mcp.js';

vi.mock('../mcp/start');
vi.mock('../mcp/setup');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/mcp', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(mcpCommand.command).toEqual('mcp');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(mcpCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    beforeEach(() => {
      commandSpy.mockClear();
      demandCommandSpy.mockClear();
    });

    const subcommands = [startCommand, setupCommand];

    it('should demand the command takes one positional argument', () => {
      mcpCommand.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      mcpCommand.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      mcpCommand.builder(yargs as Argv);
      expect(module).toBeDefined();
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
