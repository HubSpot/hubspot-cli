import { Argv } from 'yargs';
import marketplaceValidate from './module/marketplace-validate.js';
import { commands } from '../lang/en.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = 'module';
const describe = commands.module.describe;

function moduleBuilder(yargs: Argv): Argv {
  yargs.command(marketplaceValidate).demandCommand(1, '');
  return yargs;
}

const builder = makeYargsBuilder(moduleBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
});

const moduleCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default moduleCommand;
