import { Argv } from 'yargs';
import schemaCommand from './customObject/schema';
import createCommand from './customObject/create';
import { i18n } from '../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { uiBetaTag, uiLink } from '../lib/ui';
import { YargsCommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = ['custom-object', 'custom-objects', 'co'];
const describe = uiBetaTag(i18n(`commands.customObject.describe`), false);

function logBetaMessage() {
  uiBetaTag(i18n(`commands.customObject.betaMessage`));
  logger.log(
    uiLink(
      i18n(`commands.customObject.seeMoreLink`),
      'https://developers.hubspot.com/docs/api/crm/crm-custom-objects'
    )
  );
  logger.log();
}

function customObjectBuilder(yargs: Argv): Argv {
  yargs.middleware([logBetaMessage]);

  yargs.command(schemaCommand).command(createCommand).demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(customObjectBuilder, command, describe);

const customObjectCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default customObjectCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = customObjectCommand;
