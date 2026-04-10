import { Argv, ArgumentsCamelCase } from 'yargs';
import { GetValidationResultsResponse } from '@hubspot/local-dev-lib/types/MarketplaceValidation';
import SpinniesManager from '../../../lib/ui/SpinniesManager.js';
import {
  kickOffValidation,
  pollForValidationFinish,
  fetchValidationResults,
  hasProcessValidationErrors,
  displayValidationResults,
} from '../../../lib/marketplaceValidate.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { logError } from '../../../lib/errorHandlers/index.js';

const command = 'marketplace-validate <path>';
const describe =
  commands.cms.subcommands.theme.subcommands.marketplaceValidate.describe;

export type ThemeValidateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { path: string };

async function handler(
  args: ArgumentsCamelCase<ThemeValidateArgs>
): Promise<void> {
  const { path, derivedAccountId, exit } = args;

  SpinniesManager.add('marketplaceValidation', {
    text: commands.cms.subcommands.theme.subcommands.marketplaceValidate.logs.validatingTheme(
      path
    ),
  });

  const assetType = 'THEME';
  let validationId: number;
  try {
    validationId = await kickOffValidation(derivedAccountId, assetType, path);
    await pollForValidationFinish(derivedAccountId, validationId);
  } catch (e) {
    logError(e);
    return exit(EXIT_CODES.ERROR);
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
    return exit(EXIT_CODES.ERROR);
  }

  const hasErrors = hasProcessValidationErrors(
    commands.cms.subcommands.theme.subcommands.marketplaceValidate.errors
      .invalidPath,
    validationResults
  );

  if (hasErrors) {
    return exit(EXIT_CODES.ERROR);
  }

  displayValidationResults(
    commands.cms.subcommands.theme.subcommands.marketplaceValidate.results,
    validationResults
  );

  return exit(EXIT_CODES.SUCCESS);
}

function themeValidateBuilder(yargs: Argv): Argv<ThemeValidateArgs> {
  yargs.positional('path', {
    describe:
      commands.cms.subcommands.theme.subcommands.marketplaceValidate.positionals
        .path.describe,
    type: 'string',
    required: true,
  });

  return yargs as Argv<ThemeValidateArgs>;
}

const builder = makeYargsBuilder<ThemeValidateArgs>(
  themeValidateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const themeValidateCommand: YargsCommandModule<unknown, ThemeValidateArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('validate', handler),
  builder,
};

export default themeValidateCommand;
