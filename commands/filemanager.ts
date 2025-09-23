import { Argv } from 'yargs';
import upload from './filemanager/upload.js';
import fetch from './filemanager/fetch.js';
import { commands } from '../lang/en.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = 'filemanager';
const describe = commands.filemanager.describe;

function fileManagerBuilder(yargs: Argv): Argv {
  yargs.command(upload).command(fetch).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(fileManagerBuilder, command, describe);

const fileManagerCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default fileManagerCommand;
