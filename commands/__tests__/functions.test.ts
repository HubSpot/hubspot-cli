// @ts-nocheck
import yargs from 'yargs';
import list from '../functions/list';
import deploy from '../functions/deploy';
import server from '../functions/server';
import { addAccountOptions, addConfigOptions } from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../functions/list');
jest.mock('../functions/deploy');
jest.mock('../functions/server');
jest.mock('../../lib/commonOpts');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import functionsCommand from '../functions';

describe('commands/functions', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(functionsCommand.command).toEqual('functions');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(functionsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [
      ['list', { ...list, aliases: 'ls' }],
      ['deploy', deploy],
      ['server', server],
    ];

    it('should demand the command takes one positional argument', () => {
      functionsCommand.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should support the correct options', () => {
      functionsCommand.builder(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the correct number of sub commands', () => {
      functionsCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      functionsCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
