import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import {
  trackCommandMetadataUsage,
  trackCommandUsage,
} from '../../lib/usageTracking';
import { ApiErrorContext, logError } from '../../lib/errorHandlers';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { MigrateAppOptions } from '../../types/Yargs';
import { migrateApp2025_2 } from '../../lib/app/migrate';
import { PLATFORM_VERSIONS } from '@hubspot/local-dev-lib/constants/platformVersion';
const { v2025_2, unstable } = PLATFORM_VERSIONS;
const validMigrationTargets = [v2025_2, unstable];

export const command = 'migrate';
export const describe = null; // uiBetaTag(i18n(`${i18nKey}.describe`), false);

export async function handler(options: ArgumentsCamelCase<MigrateAppOptions>) {
  const { derivedAccountId } = options;
  await trackCommandUsage('project-migrate', {}, derivedAccountId);
  const accountConfig = getAccountConfig(derivedAccountId);

  if (!accountConfig) {
    throw new Error('Account is not configured');
  }

  try {
    await migrateApp2025_2(derivedAccountId, options);
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
      'project-migrate',
      { status: 'FAILURE' },
      derivedAccountId
    );
    process.exit(EXIT_CODES.ERROR);
  }

  await trackCommandMetadataUsage(
    'project-migrate',
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
    'platform-version': {
      type: 'string',
      choices: validMigrationTargets,
      hidden: true,
      default: '2025.2',
    },
  });

  // yargs.example([[`$0 ${_.join(' ')}`, i18n(`${i18nKey}.examples.default`)]]);

  return yargs;
}
