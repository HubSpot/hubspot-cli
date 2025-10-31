import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import marketplaceValidateCommand, {
  ThemeValidateArgs,
} from '../cms/theme/marketplace-validate.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'marketplace-validate <path>';
const describe = uiDeprecatedTag(
  marketplaceValidateCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<ThemeValidateArgs>) {
  uiCommandRelocatedMessage('hs cms theme marketplace-validate');

  await marketplaceValidateCommand.handler(args);
}

function deprecatedThemeValidateBuilder(yargs: Argv): Argv<ThemeValidateArgs> {
  yargs.positional('path', {
    describe:
      commands.cms.subcommands.theme.subcommands.marketplaceValidate.positionals
        .path.describe,
    type: 'string',
    required: true,
  });

  return yargs as Argv<ThemeValidateArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  marketplaceValidateCommand.describe,
  'hs cms theme marketplace-validate'
);

const builder = makeYargsBuilder<ThemeValidateArgs>(
  deprecatedThemeValidateBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedMarketplaceValidateCommand: YargsCommandModule<
  unknown,
  ThemeValidateArgs
> = {
  ...marketplaceValidateCommand,
  describe,
  handler,
  builder,
};

export default deprecatedMarketplaceValidateCommand;
