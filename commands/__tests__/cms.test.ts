// @ts-nocheck
import yargs from 'yargs';
import lighthouseScore from '../cms/lighthouseScore';
import convertFields from '../cms/convertFields';
import getReactModule from '../cms/getReactModule';
import { addAccountOptions, addConfigOptions } from '../../lib/commonOpts';

jest.mock('yargs');
jest.mock('../cms/lighthouseScore');
jest.mock('../cms/convertFields');
jest.mock('../cms/getReactModule');
jest.mock('../../lib/commonOpts');
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import cmsCommand from '../cms';

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
    const subcommands = [
      ['lighthouseScore', lighthouseScore],
      ['convertFields', convertFields],
      ['getReactModule', getReactModule],
    ];

    it('should demand the command takes one positional argument', () => {
      cmsCommand.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should support the correct options', () => {
      cmsCommand.builder(yargs);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the correct number of sub commands', () => {
      cmsCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      cmsCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
