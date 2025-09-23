import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../lib/ui/logger.js';
import { batchCreateObjects } from '@hubspot/local-dev-lib/api/customObjects';
import { inputPrompt } from '../../lib/prompts/promptUtils.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { checkAndConvertToJson } from '../../lib/validation.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { isObjectDefinition } from '../../lib/customObject.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'create [name]';
const describe = commands.customObject.subcommands.create.describe;

type CustomObjectCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; path?: string };

async function handler(
  args: ArgumentsCamelCase<CustomObjectCreateArgs>
): Promise<void> {
  const { path, name: providedName, derivedAccountId } = args;
  let definitionPath = path;
  let name = providedName;

  trackCommandUsage('custom-object-batch-create', {}, derivedAccountId);

  if (!name) {
    name = await inputPrompt(
      commands.customObject.subcommands.create.inputName
    );
  }

  if (!definitionPath) {
    definitionPath = await inputPrompt(
      commands.customObject.subcommands.create.inputPath
    );
  }

  const filePath = getAbsoluteFilePath(definitionPath);
  const objectJson = checkAndConvertToJson(filePath);

  if (!isObjectDefinition(objectJson)) {
    uiLogger.error(
      commands.customObject.subcommands.create.errors.invalidObjectDefinition
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await batchCreateObjects(derivedAccountId, name, objectJson);
    uiLogger.success(
      commands.customObject.subcommands.create.success.objectsCreated
    );
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    uiLogger.error(
      commands.customObject.subcommands.create.errors.creationFailed(
        definitionPath
      )
    );
  }
}

function customObjectCreateBuilder(yargs: Argv): Argv<CustomObjectCreateArgs> {
  yargs
    .positional('name', {
      describe:
        commands.customObject.subcommands.create.positionals.name.describe,
      type: 'string',
    })
    .option('path', {
      describe: commands.customObject.subcommands.create.options.path.describe,
      type: 'string',
    });

  return yargs as Argv<CustomObjectCreateArgs>;
}

const builder = makeYargsBuilder<CustomObjectCreateArgs>(
  customObjectCreateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const customObjectCreateCommand: YargsCommandModule<
  unknown,
  CustomObjectCreateArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default customObjectCreateCommand;
