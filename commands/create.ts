import fs from 'fs-extra';
import { logError } from '../lib/errorHandlers/index';
import { setLogLevel } from '../lib/commonOpts';
import { resolveLocalPath } from '../lib/filesystem';
import { trackCommandUsage } from '../lib/usageTracking';
import assets from './create/index';
import { commands } from '../lang/en';
import { uiLogger } from '../lib/ui/logger';
import { CreateArgs } from '../types/Cms';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';
import { YargsCommandModule } from '../types/Yargs';
import { EXIT_CODES } from '../lib/enums/exitCodes';

const SUPPORTED_ASSET_TYPES = Object.keys(assets)
  .filter(t => !assets[t].hidden)
  .join(', ');

const command = 'create <type> [name] [dest]';
const describe = commands.create.describe(SUPPORTED_ASSET_TYPES);

async function handler(args: ArgumentsCamelCase<CreateArgs>): Promise<void> {
  const { name, internal: getInternalVersion, type } = args;
  let { dest } = args;

  setLogLevel(args);
  const assetType = type.toLowerCase();

  if (assetType === 'global-partial') {
    uiLogger.error(
      commands.create.errors.deprecatedAssetType(
        assetType,
        'hs create template',
        'global partial'
      )
    );
    return;
  }

  if (!assetType || !assets[assetType]) {
    uiLogger.error(
      commands.create.errors.unsupportedAssetType(
        assetType,
        SUPPORTED_ASSET_TYPES
      )
    );
    return;
  }

  const asset = assets[assetType];
  const argsToPass = {
    commandArgs: args,
    assetType,
    name,
    dest,
    getInternalVersion: getInternalVersion || false,
  };
  dest = argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));

  const { derivedAccountId } = args;
  trackCommandUsage('create', { assetType }, derivedAccountId);

  try {
    await fs.ensureDir(dest);
  } catch (e) {
    uiLogger.error(commands.create.errors.unusablePath(dest));
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

function createBuilder(yargs: Argv): Argv<CreateArgs> {
  yargs.positional('type', {
    describe: commands.create.positionals.type.describe,
    type: 'string',
  });
  yargs.positional('name', {
    describe: commands.create.positionals.name.describe,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.create.positionals.dest.describe,
    type: 'string',
  });
  yargs.option('internal', {
    describe: 'Internal HubSpot version of creation command',
    type: 'boolean',
    hidden: true,
  });

  return yargs as Argv<CreateArgs>;
}

const builder = makeYargsBuilder<CreateArgs>(createBuilder, command, describe, {
  useGlobalOptions: true,
  useConfigOptions: true,
});

const createCommand: YargsCommandModule<unknown, CreateArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default createCommand;
module.exports = createCommand;
