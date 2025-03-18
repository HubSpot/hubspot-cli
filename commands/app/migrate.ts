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
import { migrateAppTo2023_2, migrateToUnifiedApp } from '../../lib/app/migrate';

// TODO: Move this somewhere else
const platformVersions = {
  v2023_2: '2023.2',
  v2025_2: '2025.2',
  unstable: 'unstable',
};

const { v2023_2, v2025_2 } = platformVersions;
const supportedPlatformVersions = [v2023_2, v2025_2];

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

  if (!supportedPlatformVersions.includes(platformVersion)) {
    throw new Error('Unsupported platform version');
  }

  try {
    if (platformVersion === v2025_2) {
      await migrateToUnifiedApp(derivedAccountId, accountConfig, options);
    } else if (platformVersion === v2023_2) {
      await migrateAppTo2023_2(accountConfig, options, derivedAccountId);
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

export function builder(yargs: Argv) {
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
      choices: ['2023.2', '2025.2'],
      hidden: true,
      default: '2023.2',
    },
  });

  yargs.example([['$0 app migrate', i18n(`${i18nKey}.examples.default`)]]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
}
