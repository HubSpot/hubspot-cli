import { Argv, ArgumentsCamelCase } from 'yargs';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import {
  kickOffValidation,
  pollForValidationFinish,
  fetchValidationResults,
  processValidationErrors,
  displayValidationResults,
} from '../../../lib/marketplaceValidate.js';
import { commands } from '../../../lang/en.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'marketplace-validate <src>';
const describe =
  commands.cms.subcommands.module.subcommands.marketplaceValidate.describe;

export type MarketplaceValidateArgs = CommonArgs &
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
    text: commands.cms.subcommands.module.subcommands.marketplaceValidate.logs.validatingModule(
      src
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
    commands.cms.subcommands.module.subcommands.marketplaceValidate.errors
      .invalidPath,
    validationResults
  );
  displayValidationResults(
    commands.cms.subcommands.module.subcommands.marketplaceValidate.results,
    validationResults
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function marketplaceValidateBuilder(
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
