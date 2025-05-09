import { Argv } from 'yargs';
import list from './function/list';
import deploy from './function/deploy';
import server from './function/server';
import { i18n } from '../lib/lang';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModuleBucket } from '../types/Yargs';

export const command = ['function', 'functions'];
export const describe = i18n(`commands.function.describe`);

function functionBuilder(yargs: Argv): Argv {
  yargs.command(list).command(deploy).command(server).demandCommand(1, '');
  return yargs;
}

const builder = makeYargsBuilder(functionBuilder, command, describe, {
  useGlobalOptions: true,
});

const functionCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default functionCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = functionCommand;
