import { Argv } from 'yargs';
import marketplaceValidate from './module/marketplace-validate';
import { YargsCommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = 'module';
const describe = undefined;

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

module.exports = moduleCommand;
