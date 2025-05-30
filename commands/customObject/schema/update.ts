import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchObjectSchemas,
  updateObjectSchema,
} from '@hubspot/local-dev-lib/api/customObjects';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';

import { listPrompt } from '../../../lib/prompts/promptUtils';
import { logError } from '../../../lib/errorHandlers/index';
import { checkAndConvertToJson } from '../../../lib/validation';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { isSchemaDefinition } from '../../../lib/customObject';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';

const command = 'update [name]';
const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.update.describe`
);

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
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.update.errors.invalidSchema`
      )
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
            i18n(
              `commands.customObject.subcommands.schema.subcommands.update.selectSchema`
            ),
            {
              choices: schemaNames,
            }
          );

    const { data } = await updateObjectSchema(
      derivedAccountId,
      name,
      schemaJson
    );
    logger.success(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.update.success.viewAtUrl`,
        {
          url: `${getHubSpotWebsiteOrigin(
            getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
          )}/contacts/${derivedAccountId}/objects/${data.objectTypeId}`,
        }
      )
    );
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.update.errors.update`,
        {
          definition: path,
        }
      )
    );
  }
}

function schemaUpdateBuilder(yargs: Argv): Argv<SchemaUpdateArgs> {
  yargs
    .positional('name', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.update.positionals.name.describe`
      ),
      type: 'string',
    })
    .option('path', {
      describe: i18n(
        `commands.customObject.subcommands.schema.subcommands.update.options.path.describe`
      ),
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
