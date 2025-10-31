import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsWatchCommand, { WatchCommandArgs } from './cms/watch.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'watch [src] [dest]';
const describe = uiDeprecatedTag(cmsWatchCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<WatchCommandArgs>) {
  uiCommandRelocatedMessage('hs cms watch');

  await cmsWatchCommand.handler(args);
}

function deprecatedCmsWatchBuilder(yargs: Argv): Argv<WatchCommandArgs> {
  yargs.positional('src', {
    describe: commands.cms.subcommands.watch.positionals.src,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.cms.subcommands.watch.positionals.dest,
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: commands.cms.subcommands.watch.options.options,
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('remove', {
    alias: 'r',
    describe: commands.cms.subcommands.watch.options.remove,
    type: 'boolean',
  });
  yargs.option('initial-upload', {
    alias: 'i',
    describe: commands.cms.subcommands.watch.options.initialUpload,
    type: 'boolean',
  });
  yargs.option('disable-initial', {
    describe: commands.cms.subcommands.watch.options.disableInitial,
    type: 'boolean',
    hidden: true,
  });
  yargs.option('notify', {
    alias: 'n',
    describe: commands.cms.subcommands.watch.options.notify,
    type: 'string',
    requiresArg: true,
  });
  yargs.option('convertFields', {
    describe: commands.cms.subcommands.watch.options.convertFields,
    type: 'boolean',
    default: false,
  });
  yargs.option('saveOutput', {
    describe: commands.cms.subcommands.watch.options.saveOutput,
    type: 'boolean',
    default: false,
  });

  return yargs as Argv<WatchCommandArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsWatchCommand.describe,
  'hs cms watch'
);

const builder = makeYargsBuilder<WatchCommandArgs>(
  deprecatedCmsWatchBuilder,
  command,
  verboseDescribe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useGlobalOptions: true,
    useEnvironmentOptions: true,
    useCmsPublishModeOptions: { write: true },
  }
);

const deprecatedCmsWatchCommand: YargsCommandModule<unknown, WatchCommandArgs> =
  {
    ...cmsWatchCommand,
    describe,
    handler,
    builder,
  };

export default deprecatedCmsWatchCommand;
