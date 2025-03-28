import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { ApiErrorContext, logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { MigrateAppOptions } from '../../types/Yargs';
import { migrateApp2023_2, migrateApp2025_2 } from '../../lib/app/migrate';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/platformVersion';

const { v2023_2, v2025_2, unstable } = PLATFORM_VERSIONS;
const validMigrationTargets = [v2023_2, v2025_2, unstable];

const i18nKey = 'commands.project.subcommands.migrateApp';

export const command = 'migrate';
export const describe = null; // uiBetaTag(i18n(`${i18nKey}.describe`), false);

export async function handler(options: ArgumentsCamelCase<MigrateAppOptions>) {
  const { derivedAccountId, platformVersion } = options;
  await trackCommandUsage('migrate-app', {}, derivedAccountId);
  const accountConfig = getAccountConfig(derivedAccountId);

  if (!accountConfig) {
    throw new Error('Account is not configured');
  }

  try {
    if (platformVersion === v2025_2 || platformVersion === unstable) {
      await migrateApp2025_2(derivedAccountId, options);
    } else if (platformVersion === v2023_2) {
      await migrateApp2023_2(derivedAccountId, options, accountConfig);
    }
    await trackCommandMetadataUsage(
      'migrate-app',
      { status: 'SUCCESS' },
      derivedAccountId
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      error.errors.forEach(err => logError(err));
    } else {
      logError(error, new ApiErrorContext({ accountId: derivedAccountId }));
    }
    await trackCommandMetadataUsage(
      'migrate-app',
      { status: 'FAILURE' },
      derivedAccountId
    );
    process.exit(EXIT_CODES.ERROR);
  }

  await trackCommandMetadataUsage(
    'migrate-app',
    { status: 'SUCCESS' },
    derivedAccountId
  );
  process.exit(EXIT_CODES.SUCCESS);
}

export async function builder(yargs: Argv) {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.options({
    name: {
      describe: i18n(`${i18nKey}.options.name.describe`),
      type: 'string',
    },
    dest: {
      describe: i18n(`${i18nKey}.options.dest.describe`),
      type: 'string',
    },
    'app-id': {
      describe: i18n(`${i18nKey}.options.appId.describe`),
      type: 'number',
    },
    'platform-version': {
      type: 'string',
      choices: validMigrationTargets,
      hidden: true,
      default: '2023.2',
    },
  });

  // This is a hack so we can use the same function for both the app migrate and project migrate-app commands
  // and have the examples be correct.  If we don't can about that we can remove this.
  const { _ } = await yargs.argv;
  yargs.example([[`$0 ${_.join(' ')}`, i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
}
