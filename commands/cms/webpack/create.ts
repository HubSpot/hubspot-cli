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

const command = 'create [dest]';
const describe = commands.cms.subcommands.webpack.subcommands.create.describe;

type WebpackCreateArgs = CommonArgs &
  ConfigArgs & {
    dest?: string;
  };

async function handler(
  args: ArgumentsCamelCase<WebpackCreateArgs>
): Promise<void> {
  const { dest, derivedAccountId } = args;

  const assetType = 'webpack-serverless';

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
      commands.cms.subcommands.webpack.subcommands.create.errors.unusablePath(
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

function webpackCreateBuilder(yargs: Argv): Argv<WebpackCreateArgs> {
  yargs.positional('dest', {
    describe:
      commands.cms.subcommands.webpack.subcommands.create.positionals.dest,
    type: 'string',
  });

  return yargs as Argv<WebpackCreateArgs>;
}

const builder = makeYargsBuilder<WebpackCreateArgs>(
  webpackCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const webpackCreateCommand: YargsCommandModule<unknown, WebpackCreateArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default webpackCreateCommand;
