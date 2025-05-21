import { Argv } from 'yargs';
import marketplaceValidate from './theme/marketplace-validate';
import generateSelectors from './theme/generate-selectors';
import previewCommand from './theme/preview';
import { i18n } from '../lib/lang';
import { YargsCommandModuleBucket } from '../types/Yargs';
import { makeYargsBuilder } from '../lib/yargsUtils';

const command = ['theme', 'themes'];
const describe = i18n('commands.theme.describe');

function themeBuilder(yargs: Argv): Argv {
  yargs
    .command(previewCommand)
    .command(marketplaceValidate)
    .command(generateSelectors)
    .demandCommand(1, '');

  return yargs;
}

const builder = makeYargsBuilder(themeBuilder, command, describe);

const themeCommand: YargsCommandModuleBucket = {
  command,
  describe,
  builder,
  handler: () => {},
};

export default themeCommand;

// TODO Remove this legacy export once we've migrated all commands to TS
module.exports = themeCommand;
