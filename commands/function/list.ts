import { Argv, ArgumentsCamelCase } from 'yargs';
import moment from 'moment';
import { getRoutes } from '@hubspot/local-dev-lib/api/functions';
import { logger } from '@hubspot/local-dev-lib/logger';

import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { getTableContents, getTableHeader } from '../../lib/ui/table';
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

const command = ['list', 'ls'];
const describe = i18n('commands.function.subcommands.list.describe');

type FunctionListArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { json?: boolean };

async function handler(
  args: ArgumentsCamelCase<FunctionListArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('function-list', undefined, derivedAccountId);

  logger.debug(
    i18n('commands.function.subcommands.list.debug.gettingFunctions')
  );

  const { data: routesResp } = await getRoutes(derivedAccountId).catch(
    async e => {
      logError(e, new ApiErrorContext({ accountId: derivedAccountId }));
      process.exit(EXIT_CODES.SUCCESS);
    }
  );

  if (!routesResp.objects.length) {
    return logger.info(
      i18n('commands.function.subcommands.list.info.noFunctions')
    );
  }

  if (args.json) {
    return logger.log(routesResp.objects);
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
  return logger.log(getTableContents(functionsAsArrays));
}

function functionListBuilder(yargs: Argv): Argv<FunctionListArgs> {
  yargs.options({
    json: {
      describe: i18n(
        'commands.function.subcommands.list.options.json.describe'
      ),
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
