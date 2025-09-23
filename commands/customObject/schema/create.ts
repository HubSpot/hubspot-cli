import { Argv, ArgumentsCamelCase } from 'yargs';
import { uiLogger } from '../../../lib/ui/logger.js';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { createObjectSchema } from '@hubspot/local-dev-lib/api/customObjects';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
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

const command = 'create';
const describe =
  commands.customObject.subcommands.schema.subcommands.create.describe;

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
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.create.errors
        .invalidSchema
    );
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    const { data } = await createObjectSchema(derivedAccountId, schemaJson);
    uiLogger.success(
      commands.customObject.subcommands.schema.subcommands.create.success.schemaViewable(
        `${getHubSpotWebsiteOrigin(
          getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        )}/contacts/${derivedAccountId}/objects/${data.objectTypeId}`
      )
    );
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    uiLogger.error(
      commands.customObject.subcommands.schema.subcommands.create.errors.creationFailed(
        path
      )
    );
  }
}

function schemaCreateBuilder(yargs: Argv): Argv<SchemaCreateArgs> {
  yargs.option('path', {
    describe:
      commands.customObject.subcommands.schema.subcommands.create.options
        .definition.describe,
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
