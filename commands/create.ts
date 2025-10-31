import fs from 'fs-extra';
import { logError } from '../lib/errorHandlers/index.js';
import { setCLILogLevel } from '../lib/commonOpts.js';
import { resolveLocalPath } from '../lib/filesystem.js';
import { trackCommandUsage } from '../lib/usageTracking.js';
import assets from '../lib/cmsAssets/index.js';
import { commands } from '../lang/en.js';
import { uiLogger } from '../lib/ui/logger.js';
import { CreateArgs } from '../types/Cms.js';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { YargsCommandModule } from '../types/Yargs.js';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { TEMPLATE_TYPES, HTTP_METHODS, CONTENT_TYPES } from '../types/Cms.js';
import { uiDeprecatedTag } from '../lib/ui/index.js';

const SUPPORTED_ASSET_TYPES = Object.keys(assets)
  .filter(t => !assets[t].hidden)
  .join(', ');

const command = 'create <type> [name] [dest]';
const describe = uiDeprecatedTag(
  commands.create.describe(SUPPORTED_ASSET_TYPES) +
    ' Please use the create commands in `hs cms` instead.',
  false
);

async function handler(args: ArgumentsCamelCase<CreateArgs>): Promise<void> {
  const { name, internal: getInternalVersion, type } = args;
  let { dest } = args;

  setCLILogLevel(args);
  const assetType = type!.toLowerCase();

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
  yargs.option('template-type', {
    describe: commands.create.flags.templateType.describe,
    type: 'string',
    choices: [...TEMPLATE_TYPES],
  });
  yargs.option('module-label', {
    describe: commands.create.flags.moduleLabel.describe,
    type: 'string',
  });
  yargs.option('react-type', {
    describe: commands.create.flags.reactType.describe,
    type: 'boolean',
    default: false,
  });
  yargs.option('content-types', {
    describe: commands.create.flags.contentTypes.describe(CONTENT_TYPES),
    type: 'string',
  });
  yargs.option('global', {
    describe: commands.create.flags.global.describe,
    type: 'boolean',
    default: false,
  });
  yargs.option('available-for-new-content', {
    describe: commands.create.flags.availableForNewContent.describe,
    type: 'boolean',
    default: true,
  });
  yargs.option('functions-folder', {
    describe: commands.create.flags.functionsFolder.describe,
    type: 'string',
  });
  yargs.option('filename', {
    describe: commands.create.flags.filename.describe,
    type: 'string',
  });
  yargs.option('endpoint-method', {
    describe: commands.create.flags.endpointMethod.describe,
    type: 'string',
    choices: [...HTTP_METHODS],
    default: 'GET',
  });
  yargs.option('endpoint-path', {
    describe: commands.create.flags.endpointPath.describe,
    type: 'string',
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
