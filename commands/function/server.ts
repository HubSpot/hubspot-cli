import { trackCommandUsage } from '../../lib/usageTracking.js';
import { uiLogger } from '../../lib/ui/logger.js';
// This package is not typed, so we need to use require
import { start as startTestServer } from '@hubspot/serverless-dev-runtime';
import { commands } from '../../lang/en.js';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'server <path>';
const describe = undefined;

type FunctionServerArgs = CommonArgs &
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
  const { path: functionPath, derivedAccountId } = args;

  trackCommandUsage('functions-server', undefined, derivedAccountId);

  uiLogger.debug(
    commands.function.subcommands.server.debug.startingServer(functionPath)
  );

  startTestServer({
    accountId: derivedAccountId,
    ...args,
  });
}

function functionServerBuilder(yargs: Argv): Argv<FunctionServerArgs> {
  yargs.positional('path', {
    describe: commands.function.subcommands.server.positionals.path.describe,
    type: 'string',
  });

  yargs.options({
    port: {
      describe: commands.function.subcommands.server.options.port.describe,
      type: 'string',
      default: 5432,
    },
    contact: {
      describe: commands.function.subcommands.server.options.contact.describe,
      type: 'boolean',
      default: true,
    },
    watch: {
      describe: commands.function.subcommands.server.options.watch.describe,
      type: 'boolean',
      default: true,
    },
    'log-output': {
      describe: commands.function.subcommands.server.options.logOutput.describe,
      type: 'boolean',
      default: false,
    },
  });

  yargs.example([
    [
      '$0 functions server ./tmp/myFunctionFolder.functions',
      commands.function.subcommands.server.examples.default,
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
  handler,
  builder,
};

export default functionServerCommand;
