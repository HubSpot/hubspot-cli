import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import cmsThemeCommand from './cms/theme.js';
import generateSelectorsCommand from './theme/generate-selectors.js';
import marketplaceValidateCommand from './theme/marketplace-validate.js';
import previewCommand from './theme/preview.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = ['theme'];
const describe = uiDeprecatedTag(cmsThemeCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<unknown>) {
  uiCommandRelocatedMessage('hs cms theme');

  await cmsThemeCommand.handler(args);
}

function deprecatedCmsThemeBuilder(yargs: Argv): Argv {
  yargs
    .command(generateSelectorsCommand)
    .command(marketplaceValidateCommand)
    .command(previewCommand)
    .demandCommand(1, '');

  return yargs;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsThemeCommand.describe,
  'hs cms theme'
);

const builder = makeYargsBuilder(
  deprecatedCmsThemeBuilder,
  command,
  verboseDescribe
);

const deprecatedCmsThemeCommand: YargsCommandModuleBucket = {
  ...cmsThemeCommand,
  describe,
  handler,
  builder,
};

export default deprecatedCmsThemeCommand;
