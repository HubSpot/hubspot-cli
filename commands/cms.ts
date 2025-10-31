import { Argv } from 'yargs';
import { commands } from '../lang/en.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import lighthouseScore from './cms/lighthouseScore.js';
import convertFields from './cms/convertFields.js';
import getReactModule from './cms/getReactModule.js';
import watchCommand from './cms/watch.js';
import listCommand from './cms/list.js';
import uploadCommand from './cms/upload.js';
import fetchCommand from './cms/fetch.js';
import deleteCommand from './cms/delete.js';
import mvCommand from './cms/mv.js';
import functionCommand from './cms/function.js';
import lintCommand from './cms/lint.js';
import themeCommand from './cms/theme.js';
import moduleCommand from './cms/module.js';
import webpackCommand from './cms/webpack.js';
import appCommand from './cms/app.js';
import templateCommand from './cms/template.js';

const command = 'cms';
const describe = commands.cms.describe;

function cmsBuilder(yargs: Argv): Argv {
  yargs
    .command(lighthouseScore)
    .command(convertFields)
    .command(getReactModule)
    .command(watchCommand)
    .command(listCommand)
    .command(uploadCommand)
    .command(fetchCommand)
    .command(deleteCommand)
    .command(mvCommand)
    .command(functionCommand)
    .command(lintCommand)
    .command(themeCommand)
    .command(moduleCommand)
    .command(webpackCommand)
    .command(appCommand)
    .command(templateCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(cmsBuilder, command, describe);

const cmsCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default cmsCommand;
