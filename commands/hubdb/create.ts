import { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { getCwd, untildify, isValidPath } from '@hubspot/local-dev-lib/path';
import { createHubDbTable } from '@hubspot/local-dev-lib/hubdb';
import { promptUser } from '../../lib/prompts/promptUtils';
import { checkAndConvertToJson } from '../../lib/validation';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'create';
const describe = i18n(`commands.hubdb.subcommands.create.describe`);

type HubdbCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { path?: string };

function selectPathPrompt(options: HubdbCreateArgs): Promise<{ path: string }> {
  return promptUser([
    {
      name: 'path',
      message: i18n(`commands.hubdb.subcommands.create.enterPath`),
      when: !options.path,
      validate: (input: string) => {
        if (!input) {
          return i18n(`commands.hubdb.subcommands.create.errors.pathRequired`);
        }
        if (!isValidPath(input)) {
          return i18n(
            `commands.hubdb.subcommands.create.errors.invalidCharacters`
          );
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
    logger.success(
      i18n(`commands.hubdb.subcommands.create.success.create`, {
        accountId: derivedAccountId,
        rowCount: table.rowCount,
        tableId: table.tableId,
      })
    );
  } catch (e) {
    logger.error(
      i18n(`commands.hubdb.subcommands.create.errors.create`, {
        filePath: filePath || '',
      })
    );
    logError(e);
  }
}

function hubdbCreateBuilder(yargs: Argv): Argv<HubdbCreateArgs> {
  yargs.options('path', {
    describe: i18n(`commands.hubdb.subcommands.create.options.path.describe`),
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
