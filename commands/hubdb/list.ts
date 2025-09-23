import { Argv, ArgumentsCamelCase } from 'yargs';

import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';
import { Table, FetchTablesResponse } from '@hubspot/local-dev-lib/types/Hubdb';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';

import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { getTableContents, getTableHeader } from '../../lib/ui/table.js';

const command = ['list', 'ls'];
const describe = commands.hubdb.subcommands.list.describe;

type HubdbListArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;

async function getTableData(accountId: number): Promise<FetchTablesResponse> {
  try {
    const response = await fetchTables(accountId);
    return response.data;
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

// stripping the types and unnecessary fields so this data can be turned into a UI table
function mapTablesToUI(tables: Table[]): string[][] {
  return tables.map(({ id, label, name, columnCount, rowCount }) => [
    `${id}`,
    label,
    name,
    `${columnCount || 0}`,
    `${rowCount}`,
  ]);
}

async function handler(args: ArgumentsCamelCase<HubdbListArgs>): Promise<void> {
  const { derivedAccountId } = args;
  trackCommandUsage('hubdb-list', {}, derivedAccountId);

  const { results: tables, total } = await getTableData(derivedAccountId);

  const tableUIData = mapTablesToUI(tables);
  tableUIData.unshift(
    getTableHeader([
      commands.hubdb.subcommands.list.labels.id,
      commands.hubdb.subcommands.list.labels.label,
      commands.hubdb.subcommands.list.labels.name,
      commands.hubdb.subcommands.list.labels.columns,
      commands.hubdb.subcommands.list.labels.rows,
    ])
  );
  uiLogger.success(commands.hubdb.subcommands.list.success(derivedAccountId));
  uiLogger.log(' ');
  // link devs to the hubdb page in hubspot for easy access
  // TODO: This is hacky, we should make a util like getBaseUrl()
  const baseUrl = getHubSpotWebsiteOrigin(getEnv());
  uiLogger.log(
    commands.hubdb.subcommands.list.viewTablesLink(baseUrl, derivedAccountId)
  );

  // don't bother showing an empty list of tables
  if (tables.length > 0) {
    // if truncated is 0, it will be interpreted as falsy
    const truncated = total - tables.length;
    uiLogger.log(
      commands.hubdb.subcommands.list.tablesDisplayed(
        tables.length,
        total,
        truncated
      )
    );
    uiLogger.log('--------------------------------');
    uiLogger.log(commands.hubdb.subcommands.list.tables);
    uiLogger.log(getTableContents(tableUIData, { border: { bodyLeft: '  ' } }));
  } else {
    uiLogger.log(commands.hubdb.subcommands.list.noTables(derivedAccountId));
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function hubdbListBuilder(yargs: Argv): Argv<HubdbListArgs> {
  yargs.example([['$0 hubdb list']]);

  return yargs as Argv<HubdbListArgs>;
}

const builder = makeYargsBuilder<HubdbListArgs>(
  hubdbListBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const hubdbListCommand: YargsCommandModule<unknown, HubdbListArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default hubdbListCommand;
