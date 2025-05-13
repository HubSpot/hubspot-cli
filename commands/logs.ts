import { Argv, ArgumentsCamelCase } from 'yargs';
import { trackCommandUsage } from '../lib/usageTracking';
import { logger } from '@hubspot/local-dev-lib/logger';
import { outputLogs } from '../lib/ui/serverlessFunctionLogs';
import {
  getFunctionLogs,
  getLatestFunctionLog,
} from '@hubspot/local-dev-lib/api/functions';
import { tailLogs } from '../lib/serverlessLogs';
import { i18n } from '../lib/lang';
import { promptUser } from '../lib/prompts/promptUtils';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  YargsCommandModule,
  EnvironmentArgs,
} from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';
import {
  GetFunctionLogsResponse,
  FunctionLog,
} from '@hubspot/local-dev-lib/types/Functions';
import { QueryParams } from '@hubspot/local-dev-lib/types/Http';

type LogsArgs = CommonArgs &
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
    logger.error(
      i18n(`commands.logs.errors.noLogsFound`, {
        accountId,
        functionPath,
      })
    );
  }
};

const endpointLog = async (
  accountId: number,
  functionPath: string,
  options: LogsArgs
): Promise<void> => {
  const { limit, latest, follow, compact } = options;

  const requestParams: QueryParams = {
    limit,
    latest,
    follow,
    endpoint: functionPath,
  };

  logger.debug(
    i18n(`commands.logs.gettingLogs`, {
      latest,
      functionPath,
    })
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
  } else if (latest) {
    try {
      const { data } = await getLatestFunctionLog(accountId, functionPath);
      logsResp = data;
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    try {
      const { data } = await getFunctionLogs(
        accountId,
        functionPath,
        requestParams
      );
      logsResp = data;
    } catch (e) {
      handleLogsError(e, accountId, functionPath);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  if (logsResp) {
    return outputLogs(logsResp, { compact });
  }
};

const command = 'logs [endpoint]';
const describe = i18n(`commands.logs.describe`);

const handler = async (
  options: ArgumentsCamelCase<LogsArgs>
): Promise<void> => {
  const { endpoint: endpointArgValue, latest, derivedAccountId } = options;

  trackCommandUsage(
    'logs',
    latest ? { action: 'latest' } : {},
    derivedAccountId
  );

  const { endpointPromptValue } = await promptUser<{
    endpointPromptValue: string;
  }>({
    name: 'endpointPromptValue',
    message: i18n(`commands.logs.endpointPrompt`),
    when: !endpointArgValue,
  });

  await endpointLog(
    derivedAccountId,
    endpointArgValue || endpointPromptValue,
    options
  );
};

function logsBuilder(yargs: Argv): Argv<LogsArgs> {
  yargs.positional('endpoint', {
    describe: i18n(`commands.logs.positionals.endpoint.describe`),
    type: 'string',
  });
  yargs
    .options({
      latest: {
        alias: 'l',
        describe: i18n(`commands.logs.options.latest.describe`),
        type: 'boolean',
      },
      compact: {
        describe: i18n(`commands.logs.options.compact.describe`),
        type: 'boolean',
      },
      follow: {
        alias: ['f'],
        describe: i18n(`commands.logs.options.follow.describe`),
        type: 'boolean',
      },
      limit: {
        describe: i18n(`commands.logs.options.limit.describe`),
        type: 'number',
      },
    })
    .conflicts('follow', 'limit');

  yargs.example([
    ['$0 logs my-endpoint', i18n(`commands.logs.examples.default`)],
    ['$0 logs my-endpoint --limit=10', i18n(`commands.logs.examples.limit`)],
    ['$0 logs my-endpoint --follow', i18n(`commands.logs.examples.follow`)],
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
  handler,
};

export default logsCommand;

module.exports = logsCommand;
