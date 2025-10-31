import { Argv, ArgumentsCamelCase } from 'yargs';
import { downloadFileOrFolder } from '@hubspot/local-dev-lib/fileMapper';
import { CmsPublishMode } from '@hubspot/local-dev-lib/types/Files';
import {
  addCmsPublishModeOptions,
  addOverwriteOptions,
  getCmsPublishMode,
} from '../../lib/commonOpts.js';
import { resolveLocalPath } from '../../lib/filesystem.js';
import { validateCmsPublishMode } from '../../lib/validation.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';

import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';

export type FetchCommandArgs = {
  src: string;
  dest?: string;
  cmsPublishMode?: CmsPublishMode;
  staging?: boolean;
  assetVersion?: number;
  overwrite?: boolean;
} & ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  CommonArgs;

const command = 'fetch <src> [dest]';
const describe = commands.cms.subcommands.fetch.describe;

async function handler(
  options: ArgumentsCamelCase<FetchCommandArgs>
): Promise<void> {
  const { src, dest } = options;

  if (!validateCmsPublishMode(options)) {
    process.exit(EXIT_CODES.ERROR);
  }

  if (typeof src !== 'string') {
    uiLogger.error(commands.cms.subcommands.fetch.errors.sourceRequired);
    process.exit(EXIT_CODES.ERROR);
  }

  const { derivedAccountId } = options;
  const cmsPublishMode = getCmsPublishMode(options);

  trackCommandUsage('fetch', { mode: cmsPublishMode }, derivedAccountId);

  const { assetVersion, staging, overwrite } = options;
  try {
    // Fetch and write file/folder.
    await downloadFileOrFolder(
      derivedAccountId,
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
}

const fetchBuilder = (yargs: Argv): Argv<FetchCommandArgs> => {
  yargs.positional('src', {
    describe: commands.cms.subcommands.fetch.positionals.src.describe,
    type: 'string',
  });

  yargs.positional('dest', {
    describe: commands.cms.subcommands.fetch.positionals.dest.describe,
    type: 'string',
  });

  yargs.options({
    staging: {
      describe: commands.cms.subcommands.fetch.options.staging.describe,
      type: 'boolean',
      default: false,
      hidden: true,
    },
  });

  yargs.options({
    assetVersion: {
      type: 'number',
      describe: commands.cms.subcommands.fetch.options.assetVersion.describe,
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
