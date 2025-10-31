import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import marketplaceValidateCommand, {
  MarketplaceValidateArgs,
} from '../cms/module/marketplace-validate.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'marketplace-validate [src]';
const describe = uiDeprecatedTag(
  marketplaceValidateCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<MarketplaceValidateArgs>) {
  uiCommandRelocatedMessage('hs cms module marketplace-validate');

  await marketplaceValidateCommand.handler(args);
}

function deprecatedMarketplaceValidateBuilder(
  yargs: Argv
): Argv<MarketplaceValidateArgs> {
  yargs.positional('src', {
    describe:
      commands.cms.subcommands.module.subcommands.marketplaceValidate
        .positionals.src,
    type: 'string',
  });

  return yargs as Argv<MarketplaceValidateArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  marketplaceValidateCommand.describe,
  'hs cms module marketplace-validate'
);

const builder = makeYargsBuilder<MarketplaceValidateArgs>(
  deprecatedMarketplaceValidateBuilder,
  command,
  verboseDescribe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedMarketplaceValidateCommand: YargsCommandModule<
  unknown,
  MarketplaceValidateArgs
> = {
  ...marketplaceValidateCommand,
  describe,
  handler,
  builder,
};

export default deprecatedMarketplaceValidateCommand;
