import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { createObjectSchema } from '@hubspot/local-dev-lib/api/customObjects';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
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

const command = 'create';
const describe = i18n(
  `commands.customObject.subcommands.schema.subcommands.create.describe`
);

type SchemaCreateArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs & { path: string };

async function handler(
  args: ArgumentsCamelCase<SchemaCreateArgs>
): Promise<void> {
  const { path, derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-create', {}, derivedAccountId);

  const filePath = getAbsoluteFilePath(path);
  const schemaJson = checkAndConvertToJson(filePath);

  if (!isSchemaDefinition(schemaJson)) {
    logger.error(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.create.errors.invalidSchema`
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    const { data } = await createObjectSchema(derivedAccountId, schemaJson);
    logger.success(
      i18n(
        `commands.customObject.subcommands.schema.subcommands.create.success.schemaViewable`,
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
        `commands.customObject.subcommands.schema.subcommands.create.errors.creationFailed`,
        {
          definition: path,
        }
      )
    );
  }
}

function schemaCreateBuilder(yargs: Argv): Argv<SchemaCreateArgs> {
  yargs.option('path', {
    describe: i18n(
      `commands.customObject.subcommands.schema.subcommands.create.options.definition.describe`
    ),
    type: 'string',
    required: true,
  });

  return yargs as Argv<SchemaCreateArgs>;
}

const builder = makeYargsBuilder<SchemaCreateArgs>(
  schemaCreateBuilder,
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

const schemaCreateCommand: YargsCommandModule<unknown, SchemaCreateArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default schemaCreateCommand;
