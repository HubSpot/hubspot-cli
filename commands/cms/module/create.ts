import fs from 'fs-extra';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { logError } from '../../../lib/errorHandlers/index.js';
import { resolveLocalPath } from '../../../lib/filesystem.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { CONTENT_TYPES } from '../../../types/Cms.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import assets from '../../../lib/cmsAssets/index.js';

const command = 'create <name> [dest]';
const describe = commands.cms.subcommands.module.subcommands.create.describe;

type ModuleCreateArgs = CommonArgs &
  ConfigArgs & {
    name?: string;
    dest?: string;
    moduleLabel?: string;
    reactType?: boolean;
    contentTypes?: string;
    global?: boolean;
  };

async function handler(
  args: ArgumentsCamelCase<ModuleCreateArgs>
): Promise<void> {
  const { derivedAccountId, name, dest } = args;

  const assetType = 'module';

  trackCommandUsage('create', { assetType }, derivedAccountId);

  const asset = assets[assetType];
  const argsToPass = {
    commandArgs: args,
    assetType,
    name,
    dest,
  };

  if (!argsToPass.dest) {
    argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));
  }

  try {
    await fs.ensureDir(argsToPass.dest);
  } catch (e) {
    uiLogger.error(
      commands.cms.subcommands.module.subcommands.create.errors.unusablePath(
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

function moduleCreateBuilder(yargs: Argv): Argv<ModuleCreateArgs> {
  yargs.positional('name', {
    describe:
      commands.cms.subcommands.module.subcommands.create.positionals.name,
    type: 'string',
  });
  yargs.positional('dest', {
    describe:
      commands.cms.subcommands.module.subcommands.create.positionals.dest,
    type: 'string',
  });
  yargs.option('module-label', {
    describe:
      commands.cms.subcommands.module.subcommands.create.options.moduleLabel,
    type: 'string',
  });
  yargs.option('react-type', {
    describe:
      commands.cms.subcommands.module.subcommands.create.options.reactType,
    type: 'boolean',
    default: false,
  });
  yargs.option('content-types', {
    describe:
      commands.cms.subcommands.module.subcommands.create.options.contentTypes(
        CONTENT_TYPES
      ),
    type: 'string',
  });
  yargs.option('global', {
    describe: commands.cms.subcommands.module.subcommands.create.options.global,
    type: 'boolean',
    default: false,
  });

  return yargs as Argv<ModuleCreateArgs>;
}

const builder = makeYargsBuilder<ModuleCreateArgs>(
  moduleCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const moduleCreateCommand: YargsCommandModule<unknown, ModuleCreateArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default moduleCreateCommand;
