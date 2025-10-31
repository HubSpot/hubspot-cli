import fs from 'fs-extra';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { logError } from '../../../lib/errorHandlers/index.js';
import { resolveLocalPath } from '../../../lib/filesystem.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { HTTP_METHODS, HttpMethod } from '../../../types/Cms.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import assets from '../../../lib/cmsAssets/index.js';

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
  const { derivedAccountId, name, dest } = args;

  const assetType = 'function';

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
      commands.cms.subcommands.function.subcommands.create.errors.unusablePath(
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
  handler,
};

export default functionCreateCommand;
