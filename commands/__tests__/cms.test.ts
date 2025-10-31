import yargs, { Argv } from 'yargs';
import lighthouseScore from '../cms/lighthouseScore.js';
import convertFields from '../cms/convertFields.js';
import getReactModule from '../cms/getReactModule.js';
import watchCommand from '../cms/watch.js';
import listCommand from '../cms/list.js';
import uploadCommand from '../cms/upload.js';
import fetchCommand from '../cms/fetch.js';
import deleteCommand from '../cms/delete.js';
import mvCommand from '../cms/mv.js';
import functionCommand from '../cms/function.js';
import lintCommand from '../cms/lint.js';
import themeCommand from '../cms/theme.js';
import moduleCommand from '../cms/module.js';
import webpackCommand from '../cms/webpack.js';
import appCommand from '../cms/app.js';
import templateCommand from '../cms/template.js';
import cmsCommand from '../cms.js';

vi.mock('../cms/lighthouseScore');
vi.mock('../cms/convertFields');
vi.mock('../cms/getReactModule');
vi.mock('../cms/watch');
vi.mock('../cms/list');
vi.mock('../cms/upload');
vi.mock('../cms/fetch');
vi.mock('../cms/delete');
vi.mock('../cms/mv');
vi.mock('../cms/function');
vi.mock('../cms/lint');
vi.mock('../cms/theme');
vi.mock('../cms/module');
vi.mock('../cms/webpack');
vi.mock('../cms/app');
vi.mock('../cms/template');
vi.mock('../../lib/commonOpts');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
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
    const subcommands = [
      lighthouseScore,
      convertFields,
      getReactModule,
      watchCommand,
      listCommand,
      uploadCommand,
      fetchCommand,
      deleteCommand,
      mvCommand,
      functionCommand,
      lintCommand,
      themeCommand,
      moduleCommand,
      webpackCommand,
      appCommand,
      templateCommand,
    ];

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
