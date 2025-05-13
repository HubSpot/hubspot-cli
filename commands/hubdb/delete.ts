import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from '../../lib/errorHandlers/index';
import { deleteTable } from '@hubspot/local-dev-lib/api/hubdb';
import { trackCommandUsage } from '../../lib/usageTracking';
import { selectHubDBTablePrompt } from '../../lib/prompts/selectHubDBTablePrompt';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'delete [table-id]';
const describe = i18n('commands.hubdb.subcommands.delete.describe');

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
        message: i18n('commands.hubdb.subcommands.delete.shouldDeleteTable', {
          tableId,
        }),
      });

      if (!shouldDeleteTable) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteTable(derivedAccountId, tableId);
    logger.success(
      i18n('commands.hubdb.subcommands.delete.success.delete', {
        accountId: derivedAccountId,
        tableId,
      })
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e) {
    logger.error(
      i18n('commands.hubdb.subcommands.delete.errors.delete', {
        tableId: args.tableId || '',
      })
    );
    logError(e);
  }
}

function hubdbDeleteBuilder(yargs: Argv): Argv<HubdbDeleteArgs> {
  yargs.positional('table-id', {
    describe: i18n(
      'commands.hubdb.subcommands.delete.positionals.tableId.describe'
    ),
    type: 'string',
  });

  yargs.option('force', {
    describe: i18n('commands.hubdb.subcommands.delete.options.force.describe'),
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
