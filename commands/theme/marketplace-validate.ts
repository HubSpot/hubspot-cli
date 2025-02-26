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

const i18nKey = 'commands.theme.subcommands.marketplaceValidate';

export const command = 'marketplace-validate <path>';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type ThemeValidateArgs = CombinedArgs & { path: string };

export async function handler(
  args: ArgumentsCamelCase<ThemeValidateArgs>
): Promise<void> {
  const { path, derivedAccountId } = args;

  trackCommandUsage('validate', {}, derivedAccountId);

  SpinniesManager.init();

  SpinniesManager.add('marketplaceValidation', {
    text: i18n(`${i18nKey}.logs.validatingTheme`, {
      path,
    }),
  });

  const assetType = 'THEME';
  const validationId = await kickOffValidation(
    derivedAccountId,
    assetType,
    path
  );
  await pollForValidationFinish(derivedAccountId, validationId.toString());

  SpinniesManager.remove('marketplaceValidation');

  const validationResults = await fetchValidationResults(
    derivedAccountId,
    validationId.toString()
  );
  processValidationErrors(i18nKey, validationResults);
  displayValidationResults(i18nKey, validationResults);

  process.exit();
}

export function builder(yargs: Argv): Argv<ThemeValidateArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
    required: true,
  });

  return yargs as Argv<ThemeValidateArgs>;
}
