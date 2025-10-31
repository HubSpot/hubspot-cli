import fs from 'fs-extra';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { logError } from '../../../lib/errorHandlers/index.js';
import { resolveLocalPath } from '../../../lib/filesystem.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import assets from '../../../lib/cmsAssets/index.js';

const command = 'create';
const describe = commands.cms.subcommands.theme.subcommands.create.describe;

type ThemeCreateArgs = CommonArgs &
  ConfigArgs & {
    dest?: string;
  };

async function handler(
  args: ArgumentsCamelCase<ThemeCreateArgs>
): Promise<void> {
  const { derivedAccountId, dest } = args;

  const assetType = 'website-theme';

  trackCommandUsage('create', { assetType }, derivedAccountId);

  const asset = assets[assetType];
  const argsToPass = {
    commandArgs: args,
    assetType,
    dest,
  };

  if (!argsToPass.dest) {
    argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));
  }

  try {
    await fs.ensureDir(argsToPass.dest);
  } catch (e) {
    uiLogger.error(
      commands.cms.subcommands.theme.subcommands.create.errors.unusablePath(
        argsToPass.dest
      )
    );
    logError(e);
    return;
  }

  try {
    await asset.execute(argsToPass);
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
}

function themeCreateBuilder(yargs: Argv): Argv<ThemeCreateArgs> {
  yargs.positional('dest', {
    describe:
      commands.cms.subcommands.theme.subcommands.create.positionals.dest,
    type: 'string',
  });

  return yargs as Argv<ThemeCreateArgs>;
}

const builder = makeYargsBuilder<ThemeCreateArgs>(
  themeCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const themeCreateCommand: YargsCommandModule<unknown, ThemeCreateArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default themeCreateCommand;
