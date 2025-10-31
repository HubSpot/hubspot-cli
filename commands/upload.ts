import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsUploadCommand, { UploadArgs } from './cms/upload.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'upload [src] [dest]';
const describe = uiDeprecatedTag(cmsUploadCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<UploadArgs>) {
  uiCommandRelocatedMessage('hs cms upload');

  await cmsUploadCommand.handler(args);
}

function deprecatedCmsUploadBuilder(yargs: Argv): Argv<UploadArgs> {
  yargs.positional('src', {
    describe: commands.cms.subcommands.upload.positionals.src,
    type: 'string',
  });
  yargs.positional('dest', {
    describe: commands.cms.subcommands.upload.positionals.dest,
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: commands.cms.subcommands.upload.options.options,
    type: 'array',
    default: [''],
    hidden: true,
  });
  yargs.option('saveOutput', {
    describe: commands.cms.subcommands.upload.options.saveOutput,
    type: 'boolean',
    default: false,
  });
  yargs.option('convertFields', {
    describe: commands.cms.subcommands.upload.options.convertFields,
    type: 'boolean',
    default: false,
  });
  yargs.option('clean', {
    describe: commands.cms.subcommands.upload.options.clean,
    type: 'boolean',
    default: false,
  });
  yargs.option('force', {
    describe: commands.cms.subcommands.upload.options.force,
    type: 'boolean',
    default: false,
  });

  return yargs as Argv<UploadArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsUploadCommand.describe,
  'hs cms upload'
);

const builder = makeYargsBuilder<UploadArgs>(
  deprecatedCmsUploadBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useCmsPublishModeOptions: true,
  }
);

const deprecatedCmsUploadCommand: YargsCommandModule<unknown, UploadArgs> = {
  ...cmsUploadCommand,
  describe,
  handler,
  builder,
};

export default deprecatedCmsUploadCommand;
