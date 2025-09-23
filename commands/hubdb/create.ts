import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { getCwd, untildify, isValidPath } from '@hubspot/local-dev-lib/path';
import { createHubDbTable } from '@hubspot/local-dev-lib/hubdb';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { checkAndConvertToJson } from '../../lib/validation.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'create';
const describe = commands.hubdb.subcommands.create.describe;

type HubdbCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { path?: string };

function selectPathPrompt(options: HubdbCreateArgs): Promise<{ path: string }> {
  return promptUser([
    {
      name: 'path',
      message: commands.hubdb.subcommands.create.enterPath,
      when: !options.path,
      validate: (input: string) => {
        if (!input) {
          return commands.hubdb.subcommands.create.errors.pathRequired;
        }
        if (!isValidPath(input)) {
          return commands.hubdb.subcommands.create.errors.invalidCharacters;
        }
        return true;
      },
      filter: (input: string) => {
        return untildify(input);
      },
    },
  ]);
}

async function handler(
  args: ArgumentsCamelCase<HubdbCreateArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('hubdb-create', {}, derivedAccountId);

  let filePath;
  try {
    filePath =
      'path' in args && args.path
        ? path.resolve(getCwd(), args.path)
        : path.resolve(getCwd(), (await selectPathPrompt(args)).path);
    if (!checkAndConvertToJson(filePath)) {
      process.exit(EXIT_CODES.ERROR);
    }

    const table = await createHubDbTable(
      derivedAccountId,
      path.resolve(getCwd(), filePath)
    );
    uiLogger.success(
      commands.hubdb.subcommands.create.success.create(
        table.tableId,
        derivedAccountId,
        table.rowCount
      )
    );
  } catch (e) {
    uiLogger.error(
      commands.hubdb.subcommands.create.errors.create(filePath || '')
    );
    logError(e);
  }
}

function hubdbCreateBuilder(yargs: Argv): Argv<HubdbCreateArgs> {
  yargs.options('path', {
    describe: commands.hubdb.subcommands.create.options.path.describe,
    type: 'string',
  });

  return yargs as Argv<HubdbCreateArgs>;
}

const builder = makeYargsBuilder<HubdbCreateArgs>(
  hubdbCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const hubdbCreateCommand: YargsCommandModule<unknown, HubdbCreateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default hubdbCreateCommand;
