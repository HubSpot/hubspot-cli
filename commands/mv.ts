import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsMvCommand, { MvArgs } from './cms/mv.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'mv <srcPath> <destPath>';
const describe = uiDeprecatedTag(cmsMvCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<MvArgs>) {
  uiCommandRelocatedMessage('hs cms mv');

  await cmsMvCommand.handler(args);
}

function deprecatedCmsMvBuilder(yargs: Argv): Argv<MvArgs> {
  yargs.positional('srcPath', {
    describe: commands.cms.subcommands.mv.positionals.srcPath.describe,
    type: 'string',
  });
  yargs.positional('destPath', {
    describe: commands.cms.subcommands.mv.positionals.destPath.describe,
    type: 'string',
  });

  return yargs as Argv<MvArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsMvCommand.describe,
  'hs cms mv'
);

const builder = makeYargsBuilder<MvArgs>(
  deprecatedCmsMvBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedCmsMvCommand: YargsCommandModule<unknown, MvArgs> = {
  ...cmsMvCommand,
  describe,
  handler,
  builder,
};

export default deprecatedCmsMvCommand;
