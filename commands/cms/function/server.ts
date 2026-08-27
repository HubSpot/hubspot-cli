import { uiLogger } from '../../../lib/ui/logger.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { startServerlessDevRuntime } from '../../../lib/cms/serverlessDevRuntime.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'server <path>';
const describe = undefined;

export type FunctionServerArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    path: string;
    port?: string;
    contact?: boolean;
    watch?: boolean;
    'log-output'?: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<FunctionServerArgs>
): Promise<void> {
  const { path: functionPath, derivedAccountId, exit } = args;

  uiLogger.debug(
    commands.cms.subcommands.function.subcommands.server.debug.startingServer(
      functionPath
    )
  );

  try {
    await startServerlessDevRuntime({
      accountId: derivedAccountId,
      ...args,
    });
  } catch (e) {
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }
}

function functionServerBuilder(yargs: Argv): Argv<FunctionServerArgs> {
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

  yargs.example([
    [
      '$0 functions server ./tmp/myFunctionFolder.functions',
      commands.cms.subcommands.function.subcommands.server.examples.default,
    ],
  ]);

  return yargs as Argv<FunctionServerArgs>;
}

const builder = makeYargsBuilder<FunctionServerArgs>(
  functionServerBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const functionServerCommand: YargsCommandModule<unknown, FunctionServerArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('functions-server', handler),
  builder,
};

export default functionServerCommand;
