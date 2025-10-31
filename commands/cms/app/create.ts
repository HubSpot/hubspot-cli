import fs from 'fs-extra';
import { logError } from '../../../lib/errorHandlers/index.js';
import { resolveLocalPath } from '../../../lib/filesystem.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import assets from '../../../lib/cmsAssets/index.js';

const APP_ASSET_TYPES = ['api-sample', 'app', 'react-app', 'vue-app'];
const SUPPORTED_APP_TYPES = APP_ASSET_TYPES.filter(t => !assets[t].hidden).join(
  ', '
);

const command = 'create <type> [name] [dest]';
const describe = commands.cms.subcommands.app.subcommands.create.describe;

type AppCreateArgs = CommonArgs &
  ConfigArgs & {
    type: string;
    name?: string;
    dest?: string;
    internal?: boolean;
  };

async function handler(args: ArgumentsCamelCase<AppCreateArgs>): Promise<void> {
  const {
    derivedAccountId,
    name,
    internal: getInternalVersion,
    type,
    dest,
  } = args;

  const assetType = type.toLowerCase();

  if (!assetType || !APP_ASSET_TYPES.includes(assetType)) {
    uiLogger.error(
      commands.cms.subcommands.app.subcommands.create.errors.unsupportedAssetType(
        assetType,
        SUPPORTED_APP_TYPES
      )
    );
    return;
  }

  trackCommandUsage('create', { assetType }, derivedAccountId);

  const asset = assets[assetType];
  const argsToPass = {
    commandArgs: args,
    assetType,
    name,
    dest,
    getInternalVersion: getInternalVersion || false,
  };

  if (!argsToPass.dest) {
    argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));
  }

  try {
    await fs.ensureDir(argsToPass.dest);
  } catch (e) {
    uiLogger.error(
      commands.cms.subcommands.app.subcommands.create.errors.unusablePath(
        argsToPass.dest
      )
    );
    logError(e);
    return;
  }

  if (asset.validate && !asset.validate(argsToPass)) return;

  try {
    await asset.execute(argsToPass);
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
}

function appCreateBuilder(yargs: Argv): Argv<AppCreateArgs> {
  yargs.positional('type', {
    describe: commands.cms.subcommands.app.subcommands.create.positionals.type,
    type: 'string',
    choices: APP_ASSET_TYPES.filter(t => !assets[t].hidden),
  });
  yargs.positional('name', {
    describe: commands.cms.subcommands.app.subcommands.create.positionals.name,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.cms.subcommands.app.subcommands.create.positionals.dest,
    type: 'string',
  });
  yargs.option('internal', {
    describe: 'Internal HubSpot version of creation command',
    type: 'boolean',
    hidden: true,
  });

  return yargs as Argv<AppCreateArgs>;
}

const builder = makeYargsBuilder<AppCreateArgs>(
  appCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const appCreateCommand: YargsCommandModule<unknown, AppCreateArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default appCreateCommand;
