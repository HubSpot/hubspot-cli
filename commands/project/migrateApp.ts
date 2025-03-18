import { i18n } from '../../lib/lang';
import { uiDeprecatedTag } from '../../lib/ui';
import { handler as migrateHandler } from '../app/migrate';

import { ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { MigrateAppOptions } from '../../types/Yargs';

const i18nKey = 'commands.project.subcommands.migrateApp';

export const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
export const describe = uiDeprecatedTag(i18n(`${i18nKey}.describe`), false);

export async function handler(yargs: ArgumentsCamelCase<MigrateAppOptions>) {
  logger.warn(
    "The 'hs project migrate-app' command is deprecated and will be removed. Use 'hs app migrate' going forward."
  );
  await migrateHandler(yargs);
}

export { builder } from '../app/migrate';
