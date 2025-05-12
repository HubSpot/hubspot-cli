import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { batchCreateObjects } from '@hubspot/local-dev-lib/api/customObjects';
import { inputPrompt } from '../../lib/prompts/promptUtils';
import { logError } from '../../lib/errorHandlers/index';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { checkAndConvertToJson } from '../../lib/validation';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { isObjectDefinition } from '../../lib/customObject';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'create [name]';
const describe = i18n(`commands.customObject.subcommands.create.describe`);

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
      i18n(`commands.customObject.subcommands.create.inputName`)
    );
  }

  if (!definitionPath) {
    definitionPath = await inputPrompt(
      i18n(`commands.customObject.subcommands.create.inputPath`)
    );
  }

  const filePath = getAbsoluteFilePath(definitionPath);
  const objectJson = checkAndConvertToJson(filePath);

  if (!isObjectDefinition(objectJson)) {
    logger.error(
      i18n(
        `commands.customObject.subcommands.create.errors.invalidObjectDefinition`
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await batchCreateObjects(derivedAccountId, name, objectJson);
    logger.success(
      i18n(`commands.customObject.subcommands.create.success.objectsCreated`)
    );
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(`commands.customObject.subcommands.create.errors.creationFailed`, {
        definition: definitionPath,
      })
    );
  }
}

function customObjectCreateBuilder(yargs: Argv): Argv<CustomObjectCreateArgs> {
  yargs
    .positional('name', {
      describe: i18n(
        `commands.customObject.subcommands.create.positionals.name.describe`
      ),
      type: 'string',
    })
    .option('path', {
      describe: i18n(
        `commands.customObject.subcommands.create.options.path.describe`
      ),
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
