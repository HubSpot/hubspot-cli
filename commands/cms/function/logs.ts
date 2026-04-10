import { Argv, ArgumentsCamelCase } from 'yargs';
import { outputLogs } from '../../../lib/ui/serverlessFunctionLogs.js';
import {
  getFunctionLogs,
  getLatestFunctionLog,
} from '@hubspot/local-dev-lib/api/functions';
import { tailLogs } from '../../../lib/serverlessLogs.js';
import { promptUser } from '../../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  YargsCommandModule,
  EnvironmentArgs,
  ExitFunction,
} from '../../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  GetFunctionLogsResponse,
  FunctionLog,
} from '@hubspot/local-dev-lib/types/Functions';
import { QueryParams } from '@hubspot/local-dev-lib/types/Http';
import { uiLogger } from '../../../lib/ui/logger.js';
import { commands } from '../../../lang/en.js';

export type LogsArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    endpoint?: string;
    latest?: boolean;
    compact?: boolean;
    follow?: boolean;
    limit?: number;
  };

const handleLogsError = (
  e: unknown,
  accountId: number,
  functionPath: string
): void => {
  if (isHubSpotHttpError(e) && (e.status === 404 || e.status == 400)) {
    uiLogger.error(
      commands.cms.subcommands.function.subcommands.logs.errors.noLogsFound(
        functionPath,
        accountId
      )
    );
  }
};

const endpointLog = async (
  accountId: number,
  functionPath: string,
  options: LogsArgs,
  exit: ExitFunction
): Promise<void> => {
  const { limit, latest, follow, compact } = options;

  const requestParams: QueryParams = {
    limit,
    latest,
    follow,
    endpoint: functionPath,
  };

  uiLogger.debug(
    commands.cms.subcommands.function.subcommands.logs.gettingLogs(
      latest,
      functionPath
    )
  );

  let logsResp: GetFunctionLogsResponse | FunctionLog | undefined;

  if (follow) {
    const tailCall = (after?: string) =>
      getFunctionLogs(accountId, functionPath, { after });
    const fetchLatest = () => {
      try {
        return getLatestFunctionLog(accountId, functionPath);
      } catch (e) {
        handleLogsError(e, accountId, functionPath);
        return Promise.reject(e);
      }
    };

    await tailLogs(accountId, functionPath, fetchLatest, tailCall, compact);
    return exit(EXIT_CODES.SUCCESS);
  } else if (latest) {
    const { data } = await getLatestFunctionLog(accountId, functionPath);
    logsResp = data;
  } else {
    const { data } = await getFunctionLogs(
      accountId,
      functionPath,
      requestParams
    );
    logsResp = data;
  }

  if (logsResp) {
    return outputLogs(logsResp, { compact });
  }
};

const command = 'logs [endpoint]';
const describe = commands.cms.subcommands.function.subcommands.logs.describe;

const handler = async (
  options: ArgumentsCamelCase<LogsArgs>
): Promise<void> => {
  const {
    endpoint: endpointArgValue,
    latest,
    derivedAccountId,
    exit,
    addUsageMetadata,
  } = options;

  addUsageMetadata(latest ? { action: 'latest' } : {});

  const { endpointPromptValue } = await promptUser<{
    endpointPromptValue: string;
  }>({
    name: 'endpointPromptValue',
    message: commands.cms.subcommands.function.subcommands.logs.endpointPrompt,
    when: !endpointArgValue,
  });

  try {
    await endpointLog(
      derivedAccountId,
      endpointArgValue || endpointPromptValue,
      options,
      exit
    );
  } catch (e) {
    handleLogsError(
      e,
      derivedAccountId,
      endpointArgValue || endpointPromptValue
    );
    return exit(EXIT_CODES.ERROR);
  }
};

function logsBuilder(yargs: Argv): Argv<LogsArgs> {
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

  yargs.example([
    [
      '$0 logs my-endpoint',
      commands.cms.subcommands.function.subcommands.logs.examples.default,
    ],
    [
      '$0 logs my-endpoint --limit=10',
      commands.cms.subcommands.function.subcommands.logs.examples.limit,
    ],
    [
      '$0 logs my-endpoint --follow',
      commands.cms.subcommands.function.subcommands.logs.examples.follow,
    ],
  ]);

  return yargs as Argv<LogsArgs>;
}

const builder = makeYargsBuilder<LogsArgs>(logsBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
  useAccountOptions: true,
  useEnvironmentOptions: true,
});

const logsCommand: YargsCommandModule<unknown, LogsArgs> = {
  command,
  describe,
  builder,
  handler: makeYargsHandlerWithUsageTracking('logs', handler),
};

export default logsCommand;
