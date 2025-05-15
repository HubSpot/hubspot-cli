import yargs, { Argv } from 'yargs';
import lighthouseScore from '../cms/lighthouseScore';
import convertFields from '../cms/convertFields';
import getReactModule from '../cms/getReactModule';
import cmsCommand from '../cms';

jest.mock('yargs');
jest.mock('../cms/lighthouseScore');
jest.mock('../cms/convertFields');
jest.mock('../cms/getReactModule');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

describe('commands/cms', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(cmsCommand.command).toEqual('cms');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(cmsCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    const subcommands = [lighthouseScore, convertFields, getReactModule];

    it('should demand the command takes one positional argument', () => {
      cmsCommand.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      cmsCommand.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      cmsCommand.builder(yargs as Argv);
      expect(module).toBeDefined();
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
