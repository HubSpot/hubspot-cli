import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { getAbsoluteFilePath } from '@hubspot/local-dev-lib/path';
import { createObjectSchema } from '@hubspot/local-dev-lib/api/customObjects';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { Schema } from '@hubspot/local-dev-lib/types/Schemas';

import { logError } from '../../../lib/errorHandlers/index';
import { checkAndConvertToJson } from '../../../lib/validation';
import { trackCommandUsage } from '../../../lib/usageTracking';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../../lib/commonOpts';
import { i18n } from '../../../lib/lang';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
} from '../../../types/Yargs';

const i18nKey = 'commands.customObject.subcommands.schema.subcommands.create';

export const command = 'create';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs;
type SchemaCreateArgs = CombinedArgs & { path: string };

export async function handler(
  args: ArgumentsCamelCase<SchemaCreateArgs>
): Promise<void> {
  const { path, derivedAccountId } = args;

  trackCommandUsage('custom-object-schema-create', {}, derivedAccountId);

  const filePath = getAbsoluteFilePath(path);
  const schemaJson = checkAndConvertToJson<Schema>(filePath);
  if (!schemaJson) {
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    const { data } = await createObjectSchema(derivedAccountId, schemaJson);
    logger.success(
      i18n(`${i18nKey}.success.schemaViewable`, {
        url: `${getHubSpotWebsiteOrigin(
          getEnv() === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
        )}/contacts/${derivedAccountId}/objects/${data.objectTypeId}`,
      })
    );
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition: path,
      })
    );
  }
}

export function builder(yargs: Argv): Argv<SchemaCreateArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  yargs.option('path', {
    describe: i18n(`${i18nKey}.options.definition.describe`),
    type: 'string',
    required: true,
  });

  return yargs as Argv<SchemaCreateArgs>;
}
