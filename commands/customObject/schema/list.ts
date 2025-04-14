import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';

import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { listSchemas } from '../../../lib/schema';
import { i18n } from '../../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../../types/Yargs';

export const command = 'list';
export const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.list.describe`
);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;

export async function handler(
  args: ArgumentsCamelCase<CombinedArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-list', {}, derivedAccountId);

  try {
    await listSchemas(derivedAccountId);
  } catch (e) {
    logError(e);
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.list.errors.list`
      )
    );
  }
}

export function builder(yargs: Argv): Argv<CombinedArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs as Argv<CombinedArgs>;
}
