import { Argv } from 'yargs';
import list from './function/list.js';
import deploy from './function/deploy.js';
import server from './function/server.js';
import { commands } from '../lang/en.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';

export const command = ['function', 'functions'];
export const describe = commands.function.describe;

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
