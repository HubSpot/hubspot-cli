import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModule } from '../types/Yargs.js';
import cmsLintCommand, { LintArgs } from './cms/lint.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';
import { commands } from '../lang/en.js';

const command = 'lint <path>';
const describe = uiDeprecatedTag(cmsLintCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<LintArgs>) {
  uiCommandRelocatedMessage('hs cms lint');

  await cmsLintCommand.handler(args);
}

function deprecatedCmsLintBuilder(yargs: Argv): Argv<LintArgs> {
  yargs.positional('path', {
    describe: commands.cms.subcommands.lint.positionals.path.describe,
    required: true,
    type: 'string',
  });

  return yargs as Argv<LintArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsLintCommand.describe,
  'hs cms lint'
);

const builder = makeYargsBuilder<LintArgs>(
  deprecatedCmsLintBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const deprecatedCmsLintCommand: YargsCommandModule<unknown, LintArgs> = {
  ...cmsLintCommand,
  describe,
  handler,
  builder,
};

export default deprecatedCmsLintCommand;
