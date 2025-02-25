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
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.customObject.subcommands.create';

export const command = 'create [name]';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = CommonArgs & ConfigArgs & AccountArgs & EnvironmentArgs;
type CustomObjectCreateArgs = CombinedArgs & { name?: string; path?: string };

export async function handler(
  args: ArgumentsCamelCase<CustomObjectCreateArgs>
): Promise<void> {
  const { path, name: providedName, derivedAccountId } = args;
  let definitionPath = path;
  let name = providedName;

  trackCommandUsage('custom-object-batch-create', {}, derivedAccountId);

  if (!name) {
    name = await inputPrompt(i18n(`${i18nKey}.inputName`));
  }

  if (!definitionPath) {
    definitionPath = await inputPrompt(i18n(`${i18nKey}.inputPath`));
  }

  const filePath = getAbsoluteFilePath(definitionPath);
  const objectJson = checkAndConvertToJson(filePath);

  if (!isObjectDefinition(objectJson)) {
    logger.error(i18n(`${i18nKey}.errors.invalidObjectDefinition`));
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    await batchCreateObjects(derivedAccountId, name, objectJson);
    logger.success(i18n(`${i18nKey}.success.objectsCreated`));
  } catch (e) {
    logError(e, { accountId: derivedAccountId });
    logger.error(
      i18n(`${i18nKey}.errors.creationFailed`, {
        definition: definitionPath,
      })
    );
  }
}

export function builder(yargs: Argv): Argv<CustomObjectCreateArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.option('path', {
    describe: i18n(`${i18nKey}.options.path.describe`),
    type: 'string',
  });

  return yargs as Argv<CustomObjectCreateArgs>;
}
