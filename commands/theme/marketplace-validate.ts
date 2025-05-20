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
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'marketplace-validate <path>';
const describe = i18n(
  'commands.theme.subcommands.marketplaceValidate.describe'
);

type ThemeValidateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { path: string };

async function handler(
  args: ArgumentsCamelCase<ThemeValidateArgs>
): Promise<void> {
  const { path, derivedAccountId } = args;

  trackCommandUsage('validate', {}, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(
      'commands.theme.subcommands.marketplaceValidate.logs.validatingTheme',
      {
        path,
      }
    ),
  });

  const assetType = 'THEME';
  const validationId = await kickOffValidation(
    derivedAccountId,
    assetType,
    path
  );
  await pollForValidationFinish(derivedAccountId, validationId);

  SpinniesManager.remove('marketplaceValidation');

  const validationResults = await fetchValidationResults(
    derivedAccountId,
    validationId
  );
  processValidationErrors(
    'commands.theme.subcommands.marketplaceValidate',
    validationResults
  );
  displayValidationResults(
    'commands.theme.subcommands.marketplaceValidate',
    validationResults
  );

  process.exit();
}

function themeValidateBuilder(yargs: Argv): Argv<ThemeValidateArgs> {
  yargs.positional('path', {
    describe: i18n(
      'commands.theme.subcommands.marketplaceValidate.positionals.path.describe'
    ),
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
  handler,
  builder,
};

export default themeValidateCommand;
