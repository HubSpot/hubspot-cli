import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  fetchAppSecrets,
  updateAppSecret,
} from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { secretValuePrompt } from '../../../lib/prompts/secretPrompt';
import { selectAppPrompt } from '../../../lib/prompts/selectAppPrompt';
import { listPrompt } from '../../../lib/prompts/promptUtils';
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

const command = 'update [name]';
const describe = commands.app.subcommands.secret.subcommands.update.describe;

type UpdateAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; app?: number };

async function handler(
  args: ArgumentsCamelCase<UpdateAppSecretArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('app-secret-update', {}, derivedAccountId);

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.app);

  let appSecretToUpdate = args.name;

  if (!appSecretToUpdate) {
    let appSecrets: string[] = [];

    try {
      const { data: secrets } = await fetchAppSecrets(
        derivedAccountId,
        appSecretApp.id
      );
      appSecrets = secrets.results;
    } catch (err) {
      logError(err);
      process.exit(EXIT_CODES.ERROR);
    }

    if (appSecrets.length === 0) {
      logger.error(
        commands.app.subcommands.secret.subcommands.update.errors.noSecrets
      );
      process.exit(EXIT_CODES.ERROR);
    }

    appSecretToUpdate = await listPrompt(
      commands.app.subcommands.secret.subcommands.update.selectSecret,
      { choices: appSecrets }
    );
  }

  const { secretValue } = await secretValuePrompt();

  try {
    const { data: res } = await updateAppSecret(
      derivedAccountId,
      appSecretApp.id,
      appSecretToUpdate!,
      secretValue
    );

    console.log('res: ', res);

    logger.success(
      commands.app.subcommands.secret.subcommands.update.success(
        derivedAccountId,
        appSecretApp.name,
        appSecretToUpdate!
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

  yargs.option('app', {
    describe: commands.app.subcommands.secret.subcommands.update.options.app,
    type: 'number',
  });

  yargs.example(
    'update my-secret --app=1234567890',
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
