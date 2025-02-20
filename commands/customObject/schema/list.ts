import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';

import { addConfigOptions } from '../../../lib/commonOpts';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { listSchemas } from '../../../lib/schema';
import { i18n } from '../../../lib/lang';
import { CommonArgs } from '../../../types/Yargs';

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.list';

export const command = 'list';
export const describe = i18n(`${i18nKey}.describe`);

export async function handler(
  args: ArgumentsCamelCase<CommonArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-list', {}, derivedAccountId);

  try {
    await listSchemas(derivedAccountId);
  } catch (e) {
    logError(e);
    logger.error(i18n(`${i18nKey}.errors.list`));
  }
}

export function builder(yargs: Argv): Argv<CommonArgs> {
  addConfigOptions(yargs);

  return yargs as Argv<CommonArgs>;
}
