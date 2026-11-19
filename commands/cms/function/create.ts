import { Argv, ArgumentsCamelCase } from 'yargs';
import { commands } from '../../../lang/en.js';
import { HTTP_METHODS, HttpMethod } from '../../../types/Cms.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { logServerlessCreationBlocked } from '../../../lib/serverlessSunset.js';

const command = 'create [name] [dest]';
const describe = commands.cms.subcommands.function.subcommands.create.describe;

type FunctionCreateArgs = CommonArgs &
  ConfigArgs & {
    name?: string;
    dest?: string;
    functionsFolder?: string;
    filename?: string;
    endpointMethod?: HttpMethod;
    endpointPath?: string;
  };

async function handler(
  args: ArgumentsCamelCase<FunctionCreateArgs>
): Promise<void> {
  const { exit, addUsageMetadata } = args;

  addUsageMetadata({ assetType: 'function' });

  logServerlessCreationBlocked('hs cms function create');

  return exit(EXIT_CODES.ERROR);
}

function functionCreateBuilder(yargs: Argv): Argv<FunctionCreateArgs> {
  yargs.positional('name', {
    describe:
      commands.cms.subcommands.function.subcommands.create.positionals.name,
    type: 'string',
  });
  yargs.positional('dest', {
    describe:
      commands.cms.subcommands.function.subcommands.create.positionals.dest,
    type: 'string',
  });
  yargs.option('functions-folder', {
    describe:
      commands.cms.subcommands.function.subcommands.create.options
        .functionsFolder,
    type: 'string',
  });
  yargs.option('filename', {
    describe:
      commands.cms.subcommands.function.subcommands.create.options.filename,
    type: 'string',
  });
  yargs.option('endpoint-method', {
    describe:
      commands.cms.subcommands.function.subcommands.create.options
        .endpointMethod,
    type: 'string',
    choices: [...HTTP_METHODS],
    default: 'GET',
  });
  yargs.option('endpoint-path', {
    describe:
      commands.cms.subcommands.function.subcommands.create.options.endpointPath,
    type: 'string',
  });

  return yargs as Argv<FunctionCreateArgs>;
}

const builder = makeYargsBuilder<FunctionCreateArgs>(
  functionCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const functionCreateCommand: YargsCommandModule<unknown, FunctionCreateArgs> = {
  command,
  describe,
  builder,
  handler: makeWrappedYargsHandler('create', handler),
};

export default functionCreateCommand;
