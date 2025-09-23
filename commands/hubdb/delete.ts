import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { deleteTable } from '@hubspot/local-dev-lib/api/hubdb';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { selectHubDBTablePrompt } from '../../lib/prompts/selectHubDBTablePrompt.js';
import { promptUser } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { commands } from '../../lang/en.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'delete [table-id]';
const describe = commands.hubdb.subcommands.delete.describe;

type HubdbDeleteArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { tableId?: number };

async function handler(
  args: ArgumentsCamelCase<HubdbDeleteArgs>
): Promise<void> {
  const { force, derivedAccountId } = args;

  trackCommandUsage('hubdb-delete', {}, derivedAccountId);

  try {
    const { tableId } =
      'tableId' in args && args.tableId
        ? args
        : await selectHubDBTablePrompt({
            accountId: derivedAccountId,
            options: args,
          });

    if (!force) {
      const { shouldDeleteTable } = await promptUser({
        name: 'shouldDeleteTable',
        type: 'confirm',
        message: commands.hubdb.subcommands.delete.shouldDeleteTable(tableId),
      });

      if (!shouldDeleteTable) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteTable(derivedAccountId, tableId);
    uiLogger.success(
      commands.hubdb.subcommands.delete.success.delete(
        tableId,
        derivedAccountId
      )
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    uiLogger.error(
      commands.hubdb.subcommands.delete.errors.delete(args.tableId || '')
    );
    logError(e);
  }
}

function hubdbDeleteBuilder(yargs: Argv): Argv<HubdbDeleteArgs> {
  yargs.positional('table-id', {
    describe: commands.hubdb.subcommands.delete.positionals.tableId.describe,
    type: 'string',
  });

  yargs.option('force', {
    describe: commands.hubdb.subcommands.delete.options.force.describe,
    type: 'boolean',
  });

  return yargs as Argv<HubdbDeleteArgs>;
}

const builder = makeYargsBuilder<HubdbDeleteArgs>(
  hubdbDeleteBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const hubdbDeleteCommand: YargsCommandModule<unknown, HubdbDeleteArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default hubdbDeleteCommand;
