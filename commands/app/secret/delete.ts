import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  deleteAppSecret,
  fetchAppSecrets,
} from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils.js';
import { selectAppPrompt } from '../../../lib/prompts/selectAppPrompt.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { uiBetaTag } from '../../../lib/ui/index.js';

const command = 'delete [name]';
const describe = uiBetaTag(
  commands.app.subcommands.secret.subcommands.delete.describe,
  false
);

type DeleteAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; app?: number; force?: boolean };

async function handler(
  args: ArgumentsCamelCase<DeleteAppSecretArgs>
): Promise<void> {
  const { derivedAccountId, force } = args;

  trackCommandUsage('app-secret-delete', {}, derivedAccountId);

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.app);

  if (!appSecretApp) {
    process.exit(EXIT_CODES.ERROR);
  }

  let appSecretToDelete = args.name;

  if (!appSecretToDelete) {
    let appSecrets: string[] = [];

    try {
      const { data: secrets } = await fetchAppSecrets(
        derivedAccountId,
        appSecretApp.id
      );
      if (secrets.secretKeys.length > 0) {
        appSecrets = secrets.secretKeys.map(secret => secret.secretKey);
      }
    } catch (err) {
      logError(err);
      process.exit(EXIT_CODES.ERROR);
    }

    if (appSecrets.length === 0) {
      uiLogger.error(
        commands.app.subcommands.secret.subcommands.delete.errors.noSecrets
      );
      process.exit(EXIT_CODES.ERROR);
    }

    appSecretToDelete = await listPrompt(
      commands.app.subcommands.secret.subcommands.delete.selectSecret,
      { choices: appSecrets }
    );
  }

  const confirmDelete =
    force ||
    (await confirmPrompt(
      commands.app.subcommands.secret.subcommands.delete.confirmDelete(
        appSecretApp.name,
        appSecretToDelete!
      ),
      {
        defaultAnswer: false,
      }
    ));

  if (!confirmDelete) {
    uiLogger.log(
      commands.app.subcommands.secret.subcommands.delete.deleteCanceled
    );
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    await deleteAppSecret(
      derivedAccountId,
      appSecretApp.id,
      appSecretToDelete!
    );

    uiLogger.log('');
    uiLogger.success(
      commands.app.subcommands.secret.subcommands.delete.success(
        appSecretApp.name,
        appSecretToDelete!
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
  yargs.option('app', {
    describe: commands.app.subcommands.secret.subcommands.delete.options.app,
    type: 'number',
  });
  yargs.option('force', {
    describe: commands.app.subcommands.secret.subcommands.delete.options.force,
    type: 'boolean',
  });

  yargs.example(
    'delete my-secret --app=1234567890',
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
