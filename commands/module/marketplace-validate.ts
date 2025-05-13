import { Argv, ArgumentsCamelCase } from 'yargs';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  kickOffValidation,
  pollForValidationFinish,
  fetchValidationResults,
  processValidationErrors,
  displayValidationResults,
} from '../../lib/marketplaceValidate';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'marketplace-validate <src>';
const describe = i18n(
  `commands.module.subcommands.marketplaceValidate.describe`
);

type MarketplaceValidateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & {
    src: string;
  };

async function handler(
  args: ArgumentsCamelCase<MarketplaceValidateArgs>
): Promise<void> {
  const { src, derivedAccountId } = args;

  trackCommandUsage('validate', undefined, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(
      `commands.module.subcommands.marketplaceValidate.logs.validatingModule`,
      {
        path: src,
      }
    ),
  });

  const assetType = 'MODULE';
  const validationId = await kickOffValidation(
    derivedAccountId,
    assetType,
    src
  );
  await pollForValidationFinish(derivedAccountId, validationId);

  SpinniesManager.remove('marketplaceValidation');

  const validationResults = await fetchValidationResults(
    derivedAccountId,
    validationId
  );
  processValidationErrors(
    'commands.module.subcommands.marketplaceValidate',
    validationResults
  );
  displayValidationResults(
    'commands.module.subcommands.marketplaceValidate',
    validationResults
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function marketplaceValidateBuilder(
  yargs: Argv
): Argv<MarketplaceValidateArgs> {
  yargs.positional('src', {
    describe: i18n(
      `commands.module.subcommands.marketplaceValidate.positionals.src.describe`
    ),
    type: 'string',
  });

  return yargs as Argv<MarketplaceValidateArgs>;
}

const builder = makeYargsBuilder<MarketplaceValidateArgs>(
  marketplaceValidateBuilder,
  command,
  describe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const marketplaceValidateCommand: YargsCommandModule<
  unknown,
  MarketplaceValidateArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default marketplaceValidateCommand;
