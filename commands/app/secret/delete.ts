import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { deleteAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { uiAccountDescription } from '../../../lib/ui';
import { secretNamePrompt } from '../../../lib/prompts/secretPrompt';
import { i18n } from '../../../lib/lang';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import { promptUser } from '../../../lib/prompts/promptUtils';

const i18nKey = 'commands.app.subcommands.secret.subcommands.delete';

export const command = 'delete [name]';
export const describe = i18n(`${i18nKey}.describe`);

type DeleteAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; appId: number };

export async function handler(
  args: ArgumentsCamelCase<DeleteAppSecretArgs>
): Promise<void> {
  const { appId, name, derivedAccountId } = args;
  let appSecretName = name;
  let appSecretAppId = appId;

  trackCommandUsage('app-secret-delete', {}, derivedAccountId);

  try {
    const { appId: appIdPromptValue } = await promptUser({
      name: 'appId',
      message: i18n(`${i18nKey}.appIdPrompt`),
      type: 'number',
      when: !appSecretAppId,
    });

    if (appIdPromptValue) {
      appSecretAppId = appIdPromptValue;
    }

    if (!appSecretName) {
      const { secretName: name } = await secretNamePrompt();
      appSecretName = name;
    }

    await deleteAppSecret(derivedAccountId, appSecretAppId, appSecretName);

    logger.success(
      i18n(`${i18nKey}.success.add`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        appSecretName,
      })
    );
  } catch (err) {
    logError(err);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function deleteAppSecretBuilder(yargs: Argv): Argv<DeleteAppSecretArgs> {
  yargs.positional('name', {
    describe: i18n(`${i18nKey}.positionals.name.describe`),
    type: 'string',
  });

  yargs.option('app-id', {
    describe: i18n(`${i18nKey}.options.appId.describe`),
    type: 'number',
    required: true,
  });

  return yargs as Argv<DeleteAppSecretArgs>;
}

const builder = makeYargsBuilder<DeleteAppSecretArgs>(
  deleteAppSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const deleteAppSecretCommand: YargsCommandModule<unknown, DeleteAppSecretArgs> =
  {
    command,
    describe,
    handler,
    builder,
  };

export default deleteAppSecretCommand;
