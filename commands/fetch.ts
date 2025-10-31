import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsFetchCommand, { FetchCommandArgs } from './cms/fetch.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';
import {
  addCmsPublishModeOptions,
  addOverwriteOptions,
} from '../lib/commonOpts.js';

const command = 'fetch <src> [dest]';
const describe = uiDeprecatedTag(cmsFetchCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<FetchCommandArgs>) {
  uiCommandRelocatedMessage('hs cms fetch');

  await cmsFetchCommand.handler(args);
}

function deprecatedCmsFetchBuilder(yargs: Argv): Argv<FetchCommandArgs> {
  yargs.positional('src', {
    describe: commands.cms.subcommands.fetch.positionals.src.describe,
    type: 'string',
  });

  yargs.positional('dest', {
    describe: commands.cms.subcommands.fetch.positionals.dest.describe,
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: commands.cms.subcommands.fetch.options.staging.describe,
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.options({
    assetVersion: {
      type: 'number',
      describe: commands.cms.subcommands.fetch.options.assetVersion.describe,
    },
  });

  addCmsPublishModeOptions(yargs, { read: true });
  addOverwriteOptions(yargs);
  return yargs as Argv<FetchCommandArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsFetchCommand.describe,
  'hs cms fetch'
);

const builder = makeYargsBuilder<FetchCommandArgs>(
  deprecatedCmsFetchBuilder,
  command,
  verboseDescribe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useGlobalOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedCmsFetchCommand: YargsCommandModule<unknown, FetchCommandArgs> =
  {
    ...cmsFetchCommand,
    describe,
    handler,
    builder,
  };

export default deprecatedCmsFetchCommand;
