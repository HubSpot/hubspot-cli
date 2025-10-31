import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsDeleteCommand, { DeleteArgs } from './cms/delete.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'remove <path>';
const describe = uiDeprecatedTag(cmsDeleteCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<DeleteArgs>) {
  uiCommandRelocatedMessage('hs cms delete');

  await cmsDeleteCommand.handler(args);
}

function deprecatedCmsRemoveBuilder(yargs: Argv): Argv<DeleteArgs> {
  yargs.positional('path', {
    describe: commands.cms.subcommands.delete.positionals.path,
    type: 'string',
  });

  return yargs as Argv<DeleteArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsDeleteCommand.describe,
  'hs cms delete'
);

const builder = makeYargsBuilder<DeleteArgs>(
  deprecatedCmsRemoveBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedCmsRemoveCommand: YargsCommandModule<unknown, DeleteArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default deprecatedCmsRemoveCommand;
