import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import previewCommand, { ThemePreviewArgs } from '../cms/theme/preview.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'preview';
const describe = uiDeprecatedTag(previewCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<ThemePreviewArgs>) {
  uiCommandRelocatedMessage('hs cms theme preview');

  await previewCommand.handler(args);
}

function deprecatedThemePreviewBuilder(yargs: Argv): Argv<ThemePreviewArgs> {
  yargs
    .option('src', {
      describe:
        commands.cms.subcommands.theme.subcommands.preview.positionals.src,
      type: 'string',
      requiresArg: true,
    })
    .option('dest', {
      describe:
        commands.cms.subcommands.theme.subcommands.preview.positionals.dest,
      type: 'string',
      requiresArg: true,
    })
    .option('notify', {
      alias: 'n',
      describe:
        commands.cms.subcommands.theme.subcommands.preview.options.notify,
      type: 'string',
      requiresArg: true,
    })
    .option('no-ssl', {
      describe:
        commands.cms.subcommands.theme.subcommands.preview.options.noSsl,
      type: 'boolean',
    })
    .option('port', {
      describe: commands.cms.subcommands.theme.subcommands.preview.options.port,
      type: 'number',
    })
    .option('resetSession', {
      hidden: true,
      type: 'boolean',
    })
    .option('generateFieldsTypes', {
      hidden: true,
      type: 'boolean',
    });

  return yargs as Argv<ThemePreviewArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  previewCommand.describe,
  'hs cms theme preview'
);

const builder = makeYargsBuilder<ThemePreviewArgs>(
  deprecatedThemePreviewBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const deprecatedPreviewCommand: YargsCommandModule<unknown, ThemePreviewArgs> =
  {
    ...previewCommand,
    describe,
    handler,
    builder,
  };

export default deprecatedPreviewCommand;
