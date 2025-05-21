import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { deleteAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
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
import { selectAppPrompt } from '../../../lib/prompts/selectAppPrompt';

const command = 'delete [name]';
const describe = commands.app.subcommands.secret.subcommands.delete.describe;

type DeleteAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; appId?: number };

async function handler(
  args: ArgumentsCamelCase<DeleteAppSecretArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('app-secret-delete', {}, derivedAccountId);

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.appId);

  let appSecretName = args.name;

  if (!appSecretName) {
    const { secretName: name } = await secretNamePrompt();
    appSecretName = name;
  }

  try {
    await deleteAppSecret(derivedAccountId, appSecretApp.id, appSecretName);

    logger.success(
      commands.app.subcommands.secret.subcommands.delete.success(
        derivedAccountId,
        appSecretApp.name,
        appSecretName
      )
    );
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function deleteAppSecretBuilder(yargs: Argv): Argv<DeleteAppSecretArgs> {
  yargs.positional('name', {
    describe:
      commands.app.subcommands.secret.subcommands.delete.positionals.name,
    type: 'string',
  });
  yargs.option('app-id', {
    describe: commands.app.subcommands.secret.subcommands.delete.options.appId,
    type: 'number',
    required: true,
  });

  yargs.example(
    'delete my-secret --app-id=1234567890',
    commands.app.subcommands.secret.subcommands.delete.example
  );

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
