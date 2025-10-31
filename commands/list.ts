import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsListCommand, { ListArgs } from './cms/list.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'list [path]';
const describe = uiDeprecatedTag(cmsListCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<ListArgs>) {
  uiCommandRelocatedMessage('hs cms list');

  await cmsListCommand.handler(args);
}

function deprecatedCmsListBuilder(yargs: Argv): Argv<ListArgs> {
  yargs.positional('path', {
    describe: commands.cms.subcommands.list.positionals.path.describe,
    type: 'string',
  });

  return yargs as Argv<ListArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsListCommand.describe,
  'hs cms list'
);

const builder = makeYargsBuilder<ListArgs>(
  deprecatedCmsListBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedCmsListCommand: YargsCommandModule<unknown, ListArgs> = {
  ...cmsListCommand,
  describe,
  handler,
  builder,
};

export default deprecatedCmsListCommand;
