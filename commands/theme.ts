import { Argv } from 'yargs';
import marketplaceValidate from './theme/marketplace-validate.js';
import generateSelectors from './theme/generate-selectors.js';
import previewCommand from './theme/preview.js';
import { commands } from '../lang/en.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = ['theme', 'themes'];
const describe = commands.theme.describe;

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
