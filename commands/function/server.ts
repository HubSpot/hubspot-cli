import { trackCommandUsage } from '../../lib/usageTracking';
import { logger } from '@hubspot/local-dev-lib/logger';
// This package is not typed, so we need to use require
const { start: startTestServer } = require('@hubspot/serverless-dev-runtime');
import { i18n } from '../../lib/lang';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

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

  logger.debug(
    i18n('commands.function.subcommands.server.debug.startingServer', {
      functionPath,
    })
  );

  startTestServer({
    accountId: derivedAccountId,
    ...args,
  });
}

function functionServerBuilder(yargs: Argv): Argv<FunctionServerArgs> {
  yargs.positional('path', {
    describe: i18n(
      'commands.function.subcommands.server.positionals.path.describe'
    ),
    type: 'string',
  });

  yargs.options({
    port: {
      describe: i18n(
        'commands.function.subcommands.server.options.port.describe'
      ),
      type: 'string',
      default: 5432,
    },
    contact: {
      describe: i18n(
        'commands.function.subcommands.server.options.contact.describe'
      ),
      type: 'boolean',
      default: true,
    },
    watch: {
      describe: i18n(
        'commands.function.subcommands.server.options.watch.describe'
      ),
      type: 'boolean',
      default: true,
    },
    'log-output': {
      describe: i18n(
        'commands.function.subcommands.server.options.logOutput.describe'
      ),
      type: 'boolean',
      default: false,
    },
  });

  yargs.example([
    [
      '$0 functions server ./tmp/myFunctionFolder.functions',
      i18n('commands.function.subcommands.server.examples.default'),
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
