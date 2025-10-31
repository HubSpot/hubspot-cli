import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import cmsFunctionDeployCommand, {
  FunctionDeployArgs,
} from '../cms/function/deploy.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = 'deploy <path>';
const describe = uiDeprecatedTag(
  cmsFunctionDeployCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<FunctionDeployArgs>) {
  uiCommandRelocatedMessage('hs cms function deploy');

  await cmsFunctionDeployCommand.handler(args);
}

function deprecatedFunctionDeployBuilder(
  yargs: Argv
): Argv<FunctionDeployArgs> {
  yargs.positional('path', {
    describe:
      commands.cms.subcommands.function.subcommands.deploy.positionals.path
        .describe,
    type: 'string',
  });

  return yargs as Argv<FunctionDeployArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsFunctionDeployCommand.describe,
  'hs cms function deploy'
);

const builder = makeYargsBuilder<FunctionDeployArgs>(
  deprecatedFunctionDeployBuilder,
  command,
  verboseDescribe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedFunctionDeployCommand: YargsCommandModule<
  unknown,
  FunctionDeployArgs
> = {
  ...cmsFunctionDeployCommand,
  describe,
  handler,
  builder,
};

export default deprecatedFunctionDeployCommand;
