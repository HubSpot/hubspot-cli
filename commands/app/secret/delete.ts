import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { deleteAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { uiAccountDescription } from '../../../lib/ui';
import { secretNamePrompt } from '../../../lib/prompts/secretPrompt';
import { commands } from '../../../lang/en';
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

const command = 'delete [name]';
const describe = commands.app.subcommands.secret.subcommands.delete.describe;

type DeleteAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; appId: number };

async function handler(
  args: ArgumentsCamelCase<DeleteAppSecretArgs>
): Promise<void> {
  const { appId, name, derivedAccountId } = args;
  let appSecretName = name;
  let appSecretAppId = appId;

  trackCommandUsage('app-secret-delete', {}, derivedAccountId);

  try {
    const { appId: appIdPromptValue } = await promptUser({
      name: 'appId',
      message: commands.app.subcommands.secret.subcommands.delete.appIdPrompt,
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
      commands.app.subcommands.secret.subcommands.delete.success(
        appSecretName,
        uiAccountDescription(derivedAccountId)
      )
    );
  } catch (err) {
    logError(err);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function deleteAppSecretBuilder(yargs: Argv): Argv<DeleteAppSecretArgs> {
  yargs.positional('name', {
    describe:
      commands.app.subcommands.secret.subcommands.delete.positionals.name
        .describe,
    type: 'string',
  });
  yargs.option('app-id', {
    describe:
      commands.app.subcommands.secret.subcommands.delete.options.appId.describe,
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
