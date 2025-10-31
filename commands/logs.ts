import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import functionLogsCommand, { LogsArgs } from './cms/function/logs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'logs [endpoint]';
const describe = uiDeprecatedTag(functionLogsCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<LogsArgs>) {
  uiCommandRelocatedMessage('hs cms function logs');

  await functionLogsCommand.handler(args);
}

function deprecatedLogsBuilder(yargs: Argv): Argv<LogsArgs> {
  yargs.positional('endpoint', {
    describe:
      commands.cms.subcommands.function.subcommands.logs.positionals.endpoint
        .describe,
    type: 'string',
  });
  yargs
    .options({
      latest: {
        alias: 'l',
        describe:
          commands.cms.subcommands.function.subcommands.logs.options.latest
            .describe,
        type: 'boolean',
      },
      compact: {
        describe:
          commands.cms.subcommands.function.subcommands.logs.options.compact
            .describe,
        type: 'boolean',
      },
      follow: {
        alias: ['f'],
        describe:
          commands.cms.subcommands.function.subcommands.logs.options.follow
            .describe,
        type: 'boolean',
      },
      limit: {
        describe:
          commands.cms.subcommands.function.subcommands.logs.options.limit
            .describe,
        type: 'number',
      },
    })
    .conflicts('follow', 'limit');

  return yargs as Argv<LogsArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  functionLogsCommand.describe,
  'hs cms function logs'
);

const builder = makeYargsBuilder<LogsArgs>(
  deprecatedLogsBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedLogsCommand: YargsCommandModule<unknown, LogsArgs> = {
  ...functionLogsCommand,
  describe,
  handler,
  builder,
};

export default deprecatedLogsCommand;
