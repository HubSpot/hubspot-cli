import { Argv } from 'yargs';
import marketplaceValidate from './module/marketplace-validate';
import { CommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = 'module';
const describe = undefined;

type ModuleArgs = unknown;

function moduleBuilder(yargs: Argv): Argv<ModuleArgs> {
  yargs.command(marketplaceValidate).demandCommand(1, '');
  return yargs as Argv<ModuleArgs>;
}

const builder = makeYargsBuilder<ModuleArgs>(moduleBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
});

const moduleCommand: CommandModuleBucket<unknown, ModuleArgs> = {
  command,
  describe,
  builder,
};

export default moduleCommand;
