import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import generateSelectorsCommand, {
  ThemeSelectorArgs,
} from '../cms/theme/generate-selectors.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'generate-selectors <path>';
const describe = uiDeprecatedTag(
  generateSelectorsCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<ThemeSelectorArgs>) {
  uiCommandRelocatedMessage('hs cms theme generate-selectors');

  await generateSelectorsCommand.handler(args);
}

function deprecatedThemeSelectorBuilder(yargs: Argv): Argv<ThemeSelectorArgs> {
  yargs.positional('path', {
    describe:
      commands.cms.subcommands.theme.subcommands.generateSelectors.positionals
        .path,
    type: 'string',
    required: true,
  });

  return yargs as Argv<ThemeSelectorArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  generateSelectorsCommand.describe,
  'hs cms theme generate-selectors'
);

const builder = makeYargsBuilder<ThemeSelectorArgs>(
  deprecatedThemeSelectorBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
  }
);

const deprecatedGenerateSelectorsCommand: YargsCommandModule<
  unknown,
  ThemeSelectorArgs
> = {
  ...generateSelectorsCommand,
  describe,
  handler,
  builder,
};

export default deprecatedGenerateSelectorsCommand;
