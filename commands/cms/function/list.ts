import { Argv, ArgumentsCamelCase } from 'yargs';
import moment from 'moment';
import { getRoutes } from '@hubspot/local-dev-lib/api/functions';
import { uiLogger } from '../../../lib/ui/logger.js';

import { logError, ApiErrorContext } from '../../../lib/errorHandlers/index.js';
import { getTableContents, getTableHeader } from '../../../lib/ui/table.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = ['list', 'ls'];
const describe = commands.cms.subcommands.function.subcommands.list.describe;

export type FunctionListArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { json?: boolean };

async function handler(
  args: ArgumentsCamelCase<FunctionListArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('function-list', undefined, derivedAccountId);

  uiLogger.debug(
    commands.cms.subcommands.function.subcommands.list.debug.gettingFunctions
  );

  const { data: routesResp } = await getRoutes(derivedAccountId).catch(
    async e => {
      logError(e, new ApiErrorContext({ accountId: derivedAccountId }));
      process.exit(EXIT_CODES.SUCCESS);
    }
  );

  if (!routesResp.objects.length) {
    return uiLogger.info(
      commands.cms.subcommands.function.subcommands.list.info.noFunctions
    );
  }

  if (args.json) {
    return uiLogger.json(routesResp.objects);
  }

  const functionsAsArrays = routesResp.objects.map(func => {
    const { route, method, created, updated, secretNames } = func;
    return [
      route,
      method,
      secretNames.join(', '),
      moment(created).format(),
      moment(updated).format(),
    ];
  });

  functionsAsArrays.unshift(
    getTableHeader(['Route', 'Method', 'Secrets', 'Created', 'Updated'])
  );
  return uiLogger.log(getTableContents(functionsAsArrays));
}

function functionListBuilder(yargs: Argv): Argv<FunctionListArgs> {
  yargs.options({
    json: {
      describe:
        commands.cms.subcommands.function.subcommands.list.options.json
          .describe,
      type: 'boolean',
    },
  });

  return yargs as Argv<FunctionListArgs>;
}

const builder = makeYargsBuilder<FunctionListArgs>(
  functionListBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const functionListCommand: YargsCommandModule<unknown, FunctionListArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default functionListCommand;
