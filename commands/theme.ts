import { Argv } from 'yargs';
import * as marketplaceValidate from './theme/marketplace-validate';
import * as generateSelectors from './theme/generate-selectors';
import * as previewCommand from './theme/preview';
import { addGlobalOptions } from '../lib/commonOpts';
import { i18n } from '../lib/lang';

const i18nKey = 'commands.theme';

export const command = ['theme', 'themes'];
export const describe = i18n(`${i18nKey}.describe`);

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs
    .command(previewCommand)
    .command(marketplaceValidate)
    .command(generateSelectors)
    .demandCommand(1, '');

  return yargs;
}
