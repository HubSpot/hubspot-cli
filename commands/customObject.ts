import { Argv } from 'yargs';
import { addGlobalOptions } from '../lib/commonOpts';
import * as schemaCommand from './customObject/schema';
import * as createCommand from './customObject/create';
import { i18n } from '../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { uiBetaTag, uiLink } from '../lib/ui';

const i18nKey = 'commands.customObject';

export const command = ['custom-object', 'custom-objects', 'co'];
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

function logBetaMessage() {
  uiBetaTag(i18n(`${i18nKey}.betaMessage`));
  logger.log(
    uiLink(
      i18n(`${i18nKey}.seeMoreLink`),
      'https://developers.hubspot.com/docs/api/crm/crm-custom-objects'
    )
  );
  logger.log();
}

export function builder(yargs: Argv): Argv {
  addGlobalOptions(yargs);

  yargs
    .middleware([logBetaMessage])
    // @ts-ignore TODO: Fix this type error
    .command(schemaCommand)
    .command(createCommand)
    .demandCommand(1, '');

  return yargs;
}
