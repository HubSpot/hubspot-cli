import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { updateAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import {
  secretValuePrompt,
  secretNamePrompt,
} from '../../../lib/prompts/secretPrompt';
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

const command = 'update [name]';
const describe = commands.app.subcommands.secret.subcommands.update.describe;

type UpdateAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; appId?: number };

async function handler(
  args: ArgumentsCamelCase<UpdateAppSecretArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('app-secret-update', {}, derivedAccountId);

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.appId);

  let appSecretName = args.name;

  if (!appSecretName) {
    const { secretName: name } = await secretNamePrompt();
    appSecretName = name;
  }

  const { secretValue } = await secretValuePrompt();

  try {
    await updateAppSecret(
      derivedAccountId,
      appSecretApp.id,
      appSecretName,
      secretValue
    );

    logger.success(
      commands.app.subcommands.secret.subcommands.update.success(
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

function updateAppSecretBuilder(yargs: Argv): Argv<UpdateAppSecretArgs> {
  yargs.positional('name', {
    describe:
      commands.app.subcommands.secret.subcommands.update.positionals.name,
    type: 'string',
  });

  yargs.option('app-id', {
    describe: commands.app.subcommands.secret.subcommands.update.options.appId,
    type: 'number',
  });

  yargs.example(
    'update my-secret --app-id=1234567890',
    commands.app.subcommands.secret.subcommands.update.example
  );

  return yargs as Argv<UpdateAppSecretArgs>;
}

const builder = makeYargsBuilder<UpdateAppSecretArgs>(
  updateAppSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const updateAppSecretCommand: YargsCommandModule<unknown, UpdateAppSecretArgs> =
  {
    command,
    describe,
    handler,
    builder,
  };

export default updateAppSecretCommand;
