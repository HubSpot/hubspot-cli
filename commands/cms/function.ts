import { Argv } from 'yargs';
import createCommand from './function/create.js';
import listCommand from './function/list.js';
import deployCommand from './function/deploy.js';
import serverCommand from './function/server.js';
import logsCommand from './function/logs.js';
import { commands } from '../../lang/en.js';
import { YargsCommandModuleBucket } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = ['function', 'functions'];
const describe = commands.cms.subcommands.function.describe;

function functionBuilder(yargs: Argv): Argv {
  yargs
    .command(createCommand)
    .command(listCommand)
    .command(deployCommand)
    .command(serverCommand)
    .command(logsCommand)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(functionBuilder, command, describe);

const functionCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default functionCommand;
