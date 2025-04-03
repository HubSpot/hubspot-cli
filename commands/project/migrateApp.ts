import { i18n } from '../../lib/lang';
import { uiCommandReference, uiDeprecatedTag } from '../../lib/ui';
import { handler as migrateHandler, builder } from '../app/migrate';

import { ArgumentsCamelCase, CommandModule } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { MigrateAppOptions } from '../../types/Yargs';

export const command = 'migrate-app';

// TODO: Leave this as deprecated and remove in the next major release
export const describe = uiDeprecatedTag(
  i18n(`commands.project.subcommands.migrateApp.describe`),
  false
);
export const deprecated = true;

export async function handler(yargs: ArgumentsCamelCase<MigrateAppOptions>) {
  logger.warn(
    i18n(`commands.project.subcommands.migrateApp.deprecationWarning`, {
      oldCommand: uiCommandReference('hs project migrate-app'),
      newCommand: uiCommandReference('hs app migrate'),
    })
  );
  await migrateHandler(yargs);
}

const migrateAppCommand: CommandModule<unknown, MigrateAppOptions> = {
  command,
  describe,
  deprecated,
  handler,
  builder,
};

export default migrateAppCommand;
