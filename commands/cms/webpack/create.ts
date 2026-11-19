import { Argv, ArgumentsCamelCase } from 'yargs';
import { commands } from '../../../lang/en.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { logServerlessCreationBlocked } from '../../../lib/serverlessSunset.js';

const command = 'create [dest]';
const describe = commands.cms.subcommands.webpack.subcommands.create.describe;

type WebpackCreateArgs = CommonArgs &
  ConfigArgs & {
    dest?: string;
  };

async function handler(
  args: ArgumentsCamelCase<WebpackCreateArgs>
): Promise<void> {
  const { exit, addUsageMetadata } = args;

  addUsageMetadata({ assetType: 'webpack-serverless' });

  logServerlessCreationBlocked('hs cms webpack create');

  return exit(EXIT_CODES.ERROR);
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
  handler: makeWrappedYargsHandler('create', handler),
};

export default webpackCreateCommand;
