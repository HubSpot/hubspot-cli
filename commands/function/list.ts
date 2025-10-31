import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  uiCommandRelocatedMessage,
  uiCommandRenamedDescription,
  uiDeprecatedTag,
} from '../../lib/ui/index.js';
import { YargsCommandModule } from '../../types/Yargs.js';
import cmsFunctionListCommand, {
  FunctionListArgs,
} from '../cms/function/list.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';

const command = ['list', 'ls'];
const describe = uiDeprecatedTag(
  cmsFunctionListCommand.describe as string,
  false
);

async function handler(args: ArgumentsCamelCase<FunctionListArgs>) {
  uiCommandRelocatedMessage('hs cms function list');

  await cmsFunctionListCommand.handler(args);
}

function deprecatedFunctionListBuilder(yargs: Argv): Argv<FunctionListArgs> {
  yargs.options({
    json: {
      describe:
        commands.cms.subcommands.function.subcommands.list.options.json
          .describe,
      type: 'boolean',
    },
  });

  return yargs as Argv<FunctionListArgs>;
}

const verboseDescribe = uiCommandRenamedDescription(
  cmsFunctionListCommand.describe,
  'hs cms function list'
);

const builder = makeYargsBuilder<FunctionListArgs>(
  deprecatedFunctionListBuilder,
  command,
  verboseDescribe,
  {
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deprecatedFunctionListCommand: YargsCommandModule<
  unknown,
  FunctionListArgs
> = {
  ...cmsFunctionListCommand,
  describe,
  handler,
  builder,
};

export default deprecatedFunctionListCommand;
