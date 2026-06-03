import { ArgumentsCamelCase, Argv } from 'yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { selectAppPrompt } from '../../lib/prompts/selectAppPrompt.js';
import { listPrompt } from '../../lib/prompts/promptUtils.js';
import {
  getTypeChoices,
  handleLogDetailsRequest,
  SYSTEM_TYPE_CHOICES,
  toSystemType,
} from '../../lib/app/logs.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { SystemType } from '@hubspot/local-dev-lib/types/AppLogs';

export type AppLogDetailsArgs = CommonArgs &
  ConfigArgs &
  AccountArgs & {
    logId: string;
    app?: number;
    type?: string;
    json?: boolean;
  };

const command = 'log-details <log-id>';
const describe = commands.app.subcommands.logDetails.describe;

const handler = async (
  options: ArgumentsCamelCase<AppLogDetailsArgs>
): Promise<void> => {
  const {
    logId,
    app: appIdArg,
    type: typeArg,
    derivedAccountId,
    exit,
    addUsageMetadata,
  } = options;

  addUsageMetadata({ type: typeArg });

  let appId = appIdArg;
  if (!appId) {
    const selectedApp = await selectAppPrompt(derivedAccountId);
    if (!selectedApp) {
      return exit(EXIT_CODES.ERROR);
    }
    appId = selectedApp.id;
  }

  let rawType = typeArg;
  if (!rawType) {
    rawType = await listPrompt(
      commands.app.subcommands.logDetails.prompts.selectType,
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
    await handleLogDetailsRequest(
      derivedAccountId,
      appId,
      logId,
      systemType as SystemType,
      options
    );
    return exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }
};

function logDetailsBuilder(yargs: Argv): Argv<AppLogDetailsArgs> {
  yargs
    .positional('log-id', {
      describe: commands.app.subcommands.logDetails.positionals.logId,
      type: 'string',
      demandOption: true,
    })
    .options({
      app: {
        describe: commands.app.subcommands.logDetails.options.appId,
        type: 'number',
      },
      type: {
        describe: commands.app.subcommands.logDetails.options.type,
        type: 'string',
        choices: SYSTEM_TYPE_CHOICES,
      },
      json: {
        describe: commands.app.subcommands.logDetails.options.json,
        type: 'boolean',
      },
    });

  yargs.example([
    [
      '$0 app log-details abc-123-def --app=123456 --type=webhooks',
      commands.app.subcommands.logDetails.examples.basic,
    ],
    [
      '$0 app log-details abc-123-def --app=123456 --type=webhooks --json',
      commands.app.subcommands.logDetails.examples.json,
    ],
  ]);

  return yargs as Argv<AppLogDetailsArgs>;
}

const builder = makeYargsBuilder<AppLogDetailsArgs>(
  logDetailsBuilder,
  command,
  commands.app.subcommands.logDetails.verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const logDetailsCommand: YargsCommandModule<unknown, AppLogDetailsArgs> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('app-log-details', handler),
};

export default logDetailsCommand;
