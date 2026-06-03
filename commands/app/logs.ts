import { ArgumentsCamelCase, Argv } from 'yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { selectAppPrompt } from '../../lib/prompts/selectAppPrompt.js';
import { listPrompt } from '../../lib/prompts/promptUtils.js';
import {
  getTypeChoices,
  handleLogsRequest,
  SYSTEM_TYPE_CHOICES,
  tailAppLogs,
  toSystemType,
} from '../../lib/app/logs.js';
import { logError } from '../../lib/errorHandlers/index.js';

export type AppLogsArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    app?: number;
    type?: string;
    json?: boolean;
    limit?: number;
    since?: string;
    tail?: boolean;
    errorsOnly?: boolean;
    compact?: boolean;
  };

const command = 'logs';
const describe = commands.app.subcommands.logs.describe;

const handler = async (
  options: ArgumentsCamelCase<AppLogsArgs>
): Promise<void> => {
  const {
    app: appIdArg,
    type,
    tail,
    derivedAccountId,
    exit,
    addUsageMetadata,
  } = options;

  addUsageMetadata({
    type,
  });

  let appId = appIdArg;
  if (!appId) {
    const selectedApp = await selectAppPrompt(derivedAccountId);
    if (!selectedApp) {
      return exit(EXIT_CODES.ERROR);
    }
    appId = selectedApp.id;
  }

  let rawType = type;
  if (!rawType) {
    rawType = await listPrompt(
      commands.app.subcommands.logs.prompts.selectType,
      {
        choices: getTypeChoices(),
      }
    );

    if (!rawType) {
      return exit(EXIT_CODES.ERROR);
    }
  }

  const systemType = toSystemType(rawType);

  try {
    if (tail) {
      await tailAppLogs(derivedAccountId, appId, systemType, options);
    } else {
      await handleLogsRequest(derivedAccountId, appId, systemType, options);
    }
    return exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }
};

function logsBuilder(yargs: Argv): Argv<AppLogsArgs> {
  yargs
    .options({
      app: {
        describe: commands.app.subcommands.logs.options.appId,
        type: 'number',
      },
      type: {
        describe: commands.app.subcommands.logs.options.type,
        type: 'string',
        choices: SYSTEM_TYPE_CHOICES,
      },
      json: {
        describe: commands.app.subcommands.logs.options.json,
        type: 'boolean',
      },
      limit: {
        describe: commands.app.subcommands.logs.options.limit,
        type: 'number',
      },
      since: {
        describe: commands.app.subcommands.logs.options.since,
        type: 'string',
      },
      tail: {
        describe: commands.app.subcommands.logs.options.tail,
        type: 'boolean',
      },
      'errors-only': {
        describe: commands.app.subcommands.logs.options.errorsOnly,
        type: 'boolean',
      },
      compact: {
        describe: commands.app.subcommands.logs.options.compact,
        type: 'boolean',
      },
    })
    .conflicts('tail', ['limit', 'json']);

  yargs.example([
    [
      '$0 app logs --app=123456 --type=webhooks',
      commands.app.subcommands.logs.examples.basic,
    ],
    [
      '$0 app logs --app=123456 --type=api-call --since=1h',
      commands.app.subcommands.logs.examples.since,
    ],
    [
      '$0 app logs --app=123456 --type=serverless-execution --tail',
      commands.app.subcommands.logs.examples.tail,
    ],
    [
      '$0 app logs --app=123456 --type=crm-extensibility-card --json',
      commands.app.subcommands.logs.examples.json,
    ],
    [
      '$0 app logs --app=123456 --type=webhooks --compact',
      commands.app.subcommands.logs.examples.compact,
    ],
  ]);

  return yargs as Argv<AppLogsArgs>;
}

const builder = makeYargsBuilder<AppLogsArgs>(
  logsBuilder,
  command,
  commands.app.subcommands.logs.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const logsCommand: YargsCommandModule<unknown, AppLogsArgs> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('app-logs', handler),
};

export default logsCommand;
