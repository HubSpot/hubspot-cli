import fs from 'fs-extra';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { logError } from '../../../lib/errorHandlers/index.js';
import { resolveLocalPath } from '../../../lib/filesystem.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import {
  CreateArgs,
  TEMPLATE_TYPES,
  TemplateType,
} from '../../../types/Cms.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import assets from '../../../lib/cmsAssets/index.js';

const command = 'create <name> [dest]';
const describe = commands.cms.subcommands.template.subcommands.create.describe;

type TemplateCreateArgs = CommonArgs &
  ConfigArgs & {
    name?: string;
    dest?: string;
    templateType?: TemplateType;
  };

async function handler(
  args: ArgumentsCamelCase<TemplateCreateArgs>
): Promise<void> {
  const { derivedAccountId, name, dest } = args;

  const assetType = 'template';

  trackCommandUsage('create', { assetType }, derivedAccountId);

  const asset = assets[assetType];
  const argsToPass = {
    commandArgs: args,
    assetType,
    name,
    dest,
    getInternalVersion: false,
  };

  if (!argsToPass.dest) {
    argsToPass.dest = resolveLocalPath(asset.dest(argsToPass));
  }

  try {
    await fs.ensureDir(argsToPass.dest);
  } catch (e) {
    uiLogger.error(
      commands.cms.subcommands.template.subcommands.create.errors.unusablePath(
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

function templateCreateBuilder(yargs: Argv): Argv<TemplateCreateArgs> {
  yargs.positional('name', {
    describe:
      commands.cms.subcommands.template.subcommands.create.positionals.name,
    type: 'string',
  });
  yargs.positional('dest', {
    describe:
      commands.cms.subcommands.template.subcommands.create.positionals.dest,
    type: 'string',
  });
  yargs.option('template-type', {
    describe:
      commands.cms.subcommands.template.subcommands.create.options.templateType,
    type: 'string',
    choices: [...TEMPLATE_TYPES],
  });

  return yargs as Argv<TemplateCreateArgs>;
}

const builder = makeYargsBuilder<CreateArgs>(
  templateCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
  }
);

const templateCreateCommand: YargsCommandModule<unknown, TemplateCreateArgs> = {
  command,
  describe,
  builder,
  handler,
};

export default templateCreateCommand;
