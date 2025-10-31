import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import cmsFunctionServerCommand, {
  FunctionServerArgs,
} from '../cms/function/server.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'server <path>';
const describe = uiDeprecatedTag(
  cmsFunctionServerCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<FunctionServerArgs>) {
  uiCommandRelocatedMessage('hs cms function server');

  await cmsFunctionServerCommand.handler(args);
}

function deprecatedFunctionServerBuilder(
  yargs: Argv
): Argv<FunctionServerArgs> {
  yargs.positional('path', {
    describe:
      commands.cms.subcommands.function.subcommands.server.positionals.path
        .describe,
    type: 'string',
  });

  yargs.options({
    port: {
      describe:
        commands.cms.subcommands.function.subcommands.server.options.port
          .describe,
      type: 'string',
      default: 5432,
    },
    contact: {
      describe:
        commands.cms.subcommands.function.subcommands.server.options.contact
          .describe,
      type: 'boolean',
      default: true,
    },
    watch: {
      describe:
        commands.cms.subcommands.function.subcommands.server.options.watch
          .describe,
      type: 'boolean',
      default: true,
    },
    'log-output': {
      describe:
        commands.cms.subcommands.function.subcommands.server.options.logOutput
          .describe,
      type: 'boolean',
      default: false,
    },
  });

  return yargs as Argv<FunctionServerArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsFunctionServerCommand.describe,
  'hs cms function server'
);

const builder = makeYargsBuilder<FunctionServerArgs>(
  deprecatedFunctionServerBuilder,
  command,
  verboseDescribe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedFunctionServerCommand: YargsCommandModule<
  unknown,
  FunctionServerArgs
> = {
  ...cmsFunctionServerCommand,
  describe,
  handler,
  builder,
};

export default deprecatedFunctionServerCommand;
