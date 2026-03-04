import { Argv, ArgumentsCamelCase } from 'yargs';
import { GetValidationResultsResponse } from '@hubspot/local-dev-lib/types/MarketplaceValidation';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import {
  kickOffValidation,
  pollForValidationFinish,
  fetchValidationResults,
  hasProcessValidationErrors,
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
import { logError } from '../../../lib/errorHandlers/index.js';

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

  SpinniesManager.add('marketplaceValidation', {
    text: commands.cms.subcommands.module.subcommands.marketplaceValidate.logs.validatingModule(
      src
    ),
  });

  const assetType = 'MODULE';
  let validationId: number;
  try {
    validationId = await kickOffValidation(derivedAccountId, assetType, src);
    await pollForValidationFinish(derivedAccountId, validationId);
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }

  SpinniesManager.remove('marketplaceValidation');

  let validationResults: GetValidationResultsResponse;
  try {
    validationResults = await fetchValidationResults(
      derivedAccountId,
      validationId
    );
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }

  const hasErrors = hasProcessValidationErrors(
    commands.cms.subcommands.module.subcommands.marketplaceValidate.errors
      .invalidPath,
    validationResults
  );

  if (hasErrors) {
    process.exit(EXIT_CODES.ERROR);
  }

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
