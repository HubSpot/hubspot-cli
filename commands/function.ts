import { Argv, ArgumentsCamelCase } from 'yargs';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { uiLogger } from '../lib/ui/logger.js';
import cmsFunctionCommand from './cms/function.js';
import listCommand from './function/list.js';
import deployCommand from './function/deploy.js';
import serverCommand from './function/server.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = ['function', 'functions'];
const describe = uiDeprecatedTag(cmsFunctionCommand.describe as string, false);

// We cannot use the builder from cmsFunctionCommand because it includes the create and logs commands
function functionBuilder(yargs: Argv): Argv {
  yargs
    .command(listCommand)
    .command(deployCommand)
    .command(serverCommand)
    .demandCommand(1, '');

  return yargs;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsFunctionCommand.describe,
  'hs cms function'
);

const builder = makeYargsBuilder(functionBuilder, command, verboseDescribe);

async function handler(args: ArgumentsCamelCase<unknown>) {
  uiCommandRelocatedMessage('hs cms function');

  uiLogger.log('');

  await cmsFunctionCommand.handler(args);
}

const deprecatedFunctionCommand: YargsCommandModuleBucket = {
  ...cmsFunctionCommand,
  describe,
  builder,
  handler,
};

export default deprecatedFunctionCommand;
