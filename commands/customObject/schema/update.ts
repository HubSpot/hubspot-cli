import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchObjectSchemas,
  updateObjectSchema,
} from '@hubspot/local-dev-lib/api/customObjects';
import { uiLogger } from '../../../lib/ui/logger.js';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';

import { listPrompt } from '../../../lib/prompts/promptUtils.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { checkAndConvertToJson } from '../../../lib/validation.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { isSchemaDefinition } from '../../../lib/customObject.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';

const command = 'update [name]';
const describe =
  commands.customObject.subcommands.schema.subcommands.update.describe;

type SchemaUpdateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs & { name?: string; path: string };

async function handler(
  args: ArgumentsCamelCase<SchemaUpdateArgs>
): Promise<void> {
  const { path, name: providedName, derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-update', {}, derivedAccountId);

  const filePath = getAbsoluteFilePath(path);
  const schemaJson = checkAndConvertToJson(filePath);
  if (!isSchemaDefinition(schemaJson)) {
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.update.errors
        .invalidSchema
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let name = providedName;
  try {
    const {
      data: { results },
    } = await fetchObjectSchemas(derivedAccountId);
    const schemaNames = results?.map(({ name: schemaName }) => schemaName);

    name =
      providedName && typeof providedName === 'string'
        ? providedName
        : await listPrompt<string>(
            commands.customObject.subcommands.schema.subcommands.update
              .selectSchema,
            {
              choices: schemaNames,
            }
          );

    const { data } = await updateObjectSchema(
      derivedAccountId,
      name,
      schemaJson
    );
    uiLogger.success(
      commands.customObject.subcommands.schema.subcommands.update.success.viewAtUrl(
        `${getHubSpotWebsiteOrigin(
          getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        )}/contacts/${derivedAccountId}/objects/${data.objectTypeId}`
      )
    );
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.update.errors.update(
        path
      )
    );
  }
}

function schemaUpdateBuilder(yargs: Argv): Argv<SchemaUpdateArgs> {
  yargs
    .positional('name', {
      describe:
        commands.customObject.subcommands.schema.subcommands.update.positionals
          .name.describe,
      type: 'string',
    })
    .option('path', {
      describe:
        commands.customObject.subcommands.schema.subcommands.update.options.path
          .describe,
      type: 'string',
      required: true,
    });

  return yargs as Argv<SchemaUpdateArgs>;
}

const builder = makeYargsBuilder<SchemaUpdateArgs>(
  schemaUpdateBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: true,
  }
);

const schemaUpdateCommand: YargsCommandModule<unknown, SchemaUpdateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default schemaUpdateCommand;
