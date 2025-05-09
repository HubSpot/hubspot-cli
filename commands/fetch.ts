import { Argv, ArgumentsCamelCase } from 'yargs';
import { downloadFileOrFolder } from '@hubspot/local-dev-lib/fileMapper';
import { logger } from '@hubspot/local-dev-lib/logger';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  addCmsPublishModeOptions,
  addOverwriteOptions,
  getCmsPublishMode,
} from '../lib/commonOpts';
import { resolveLocalPath } from '../lib/filesystem';
import { validateCmsPublishMode } from '../lib/validation';
import { trackCommandUsage } from '../lib/usageTracking';
import { i18n } from '../lib/lang';
import { makeYargsBuilder } from '../lib/yargsUtils';
import {
  AccountArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../types/Yargs';

import { EXIT_CODES } from '../lib/enums/exitCodes';
import { logError } from '../lib/errorHandlers/index';

type FetchCommandArgs = {
  src: string;
  dest?: string;
  derivedAccountId?: number;
  cmsPublishMode?: CmsPublishMode;
  staging?: boolean;
  assetVersion?: number;
  overwrite?: boolean;
} & ConfigArgs &
  AccountArgs &
  EnvironmentArgs;

const command = 'fetch <src> [dest]';
const describe = i18n('commands.fetch.describe');

const handler = async (
  options: ArgumentsCamelCase<FetchCommandArgs>
): Promise<void> => {
  const { src, dest } = options;

  if (!validateCmsPublishMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    logger.error(i18n('commands.fetch.errors.sourceRequired'));
    process.exit(EXIT_CODES.ERROR);
  }

  const { derivedAccountId } = options;
  const cmsPublishMode = getCmsPublishMode(options);

  trackCommandUsage('fetch', { mode: cmsPublishMode }, derivedAccountId);

  const { assetVersion, staging, overwrite } = options;
  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      derivedAccountId!,
      src,
      resolveLocalPath(dest),
      cmsPublishMode,
      {
        assetVersion:
          assetVersion !== undefined ? `${assetVersion}` : assetVersion,
        staging,
        overwrite,
      }
    );
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

const fetchBuilder = (yargs: Argv): Argv<FetchCommandArgs> => {
  yargs.positional('src', {
    describe: i18n('commands.fetch.positionals.src.describe'),
    type: 'string',
  });

  yargs.positional('dest', {
    describe: i18n('commands.fetch.positionals.dest.describe'),
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: i18n('commands.fetch.options.staging.describe'),
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.options({
    assetVersion: {
      type: 'number',
      describe: i18n('commands.fetch.options.assetVersion.describe'),
    },
  });

  addCmsPublishModeOptions(yargs, { read: true });
  addOverwriteOptions(yargs);
  return yargs as Argv<FetchCommandArgs>;
};

const builder = makeYargsBuilder<FetchCommandArgs>(
  fetchBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useGlobalOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: false,
  }
);

const fetchCommand: YargsCommandModule<unknown, FetchCommandArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default fetchCommand;

module.exports = fetchCommand;
