import { Argv } from 'yargs';
import upload from './filemanager/upload';
import fetch from './filemanager/fetch';
import { i18n } from '../lib/lang';
import { YargsCommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = 'filemanager';
const describe = i18n(`commands.filemanager.describe`);

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

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = fileManagerCommand;
