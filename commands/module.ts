import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../lib/ui/index.js';
import { YargsCommandModuleBucket } from '../types/Yargs.js';
import cmsModuleCommand from './cms/module.js';
import marketplaceValidateCommand from './module/marketplace-validate.js';
import { makeYargsBuilder } from '../lib/yargsUtils.js';

const command = ['module'];
const describe = uiDeprecatedTag(cmsModuleCommand.describe as string, false);

async function handler(args: ArgumentsCamelCase<unknown>) {
  uiCommandRelocatedMessage('hs cms module');

  await cmsModuleCommand.handler(args);
}

function deprecatedCmsModuleBuilder(yargs: Argv): Argv {
  yargs.command(marketplaceValidateCommand).demandCommand(1, '');

  return yargs;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsModuleCommand.describe,
  'hs cms module'
);

const builder = makeYargsBuilder(
  deprecatedCmsModuleBuilder,
  command,
  verboseDescribe
);

const deprecatedCmsModuleCommand: YargsCommandModuleBucket = {
  ...cmsModuleCommand,
  describe,
  handler,
  builder,
};

export default deprecatedCmsModuleCommand;
