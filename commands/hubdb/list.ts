import { Argv, ArgumentsCamelCase } from 'yargs';

import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';
import { Table, FetchTablesResponse } from '@hubspot/local-dev-lib/types/Hubdb';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { renderTable } from '../../ui/render.js';
import { getBaseHubSpotUrlForAccount } from '../../lib/projects/urls.js';

const command = ['list', 'ls'];
const describe = commands.hubdb.subcommands.list.describe;

type HubdbListArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;

async function getTableData(accountId: number): Promise<FetchTablesResponse> {
  const response = await fetchTables(accountId);
  return response.data;
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
  const { derivedAccountId, exit } = args;

  let tableData: FetchTablesResponse;
  try {
    tableData = await getTableData(derivedAccountId);
  } catch (err) {
    logError(err);
    return exit(EXIT_CODES.ERROR);
    return;
  }

  const { results: tables, total } = tableData;

  const tableUIData = mapTablesToUI(tables);
  const tableHeader = [
    commands.hubdb.subcommands.list.labels.id,
    commands.hubdb.subcommands.list.labels.label,
    commands.hubdb.subcommands.list.labels.name,
    commands.hubdb.subcommands.list.labels.columns,
    commands.hubdb.subcommands.list.labels.rows,
  ];

  uiLogger.success(commands.hubdb.subcommands.list.success(derivedAccountId));
  uiLogger.log(' ');
  // link devs to the hubdb page in hubspot for easy access
  const baseUrl = getBaseHubSpotUrlForAccount(derivedAccountId);

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
    renderTable(tableHeader, tableUIData);
  } else {
    uiLogger.log(commands.hubdb.subcommands.list.noTables(derivedAccountId));
  }
  return exit(EXIT_CODES.SUCCESS);
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
  handler: makeYargsHandlerWithUsageTracking('hubdb-list', handler),
  builder,
};

export default hubdbListCommand;
