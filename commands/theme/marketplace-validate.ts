import { Argv, ArgumentsCamelCase } from 'yargs';

import SpinniesManager from '../../lib/ui/SpinniesManager';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
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
} from '../../types/Yargs';

export const command = 'marketplace-validate <path>';
export const describe = i18n('commands.theme.subcommands.marketplaceValidate.describe');

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type ThemeValidateArgs = CombinedArgs & { path: string };

export async function handler(
  args: ArgumentsCamelCase<ThemeValidateArgs>
): Promise<void> {
  const { path, derivedAccountId } = args;

  trackCommandUsage('validate', {}, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n('commands.theme.subcommands.marketplaceValidate.logs.validatingTheme', {
      path,
    }),
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
  processValidationErrors('commands.theme.subcommands.marketplaceValidate', validationResults);
  displayValidationResults('commands.theme.subcommands.marketplaceValidate', validationResults);

  process.exit();
}

export function builder(yargs: Argv): Argv<ThemeValidateArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('path', {
    describe: i18n('commands.theme.subcommands.marketplaceValidate.positionals.path.describe'),
    type: 'string',
    required: true,
  });

  return yargs as Argv<ThemeValidateArgs>;
}
