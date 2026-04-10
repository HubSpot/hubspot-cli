import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  fetchAppSecrets,
  updateAppSecret,
} from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index.js';
import { secretValuePrompt } from '../../../lib/prompts/secretPrompt.js';
import { selectAppPrompt } from '../../../lib/prompts/selectAppPrompt.js';
import { listPrompt } from '../../../lib/prompts/promptUtils.js';
import { commands } from '../../../lang/en.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { uiBetaTag } from '../../../lib/ui/index.js';

const command = 'update [name]';
const describe = uiBetaTag(
  commands.app.subcommands.secret.subcommands.update.describe,
  false
);

type UpdateAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; app?: number };

async function handler(
  args: ArgumentsCamelCase<UpdateAppSecretArgs>
): Promise<void> {
  const { derivedAccountId, exit } = args;

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.app);

  if (!appSecretApp) {
    return exit(EXIT_CODES.ERROR);
  }

  let appSecretToUpdate = args.name;

  if (!appSecretToUpdate) {
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
      return exit(EXIT_CODES.ERROR);
    }

    if (appSecrets.length === 0) {
      uiLogger.error(
        commands.app.subcommands.secret.subcommands.update.errors.noSecrets
      );
      return exit(EXIT_CODES.ERROR);
    }

    appSecretToUpdate = await listPrompt(
      commands.app.subcommands.secret.subcommands.update.selectSecret,
      { choices: appSecrets }
    );
  }

  const { secretValue } = await secretValuePrompt();

  try {
    await updateAppSecret(
      derivedAccountId,
      appSecretApp.id,
      appSecretToUpdate!,
      secretValue
    );

    uiLogger.log('');
    uiLogger.success(
      commands.app.subcommands.secret.subcommands.update.success(
        appSecretApp.name,
        appSecretToUpdate!
      )
    );
  } catch (err) {
    logError(err);
    return exit(EXIT_CODES.ERROR);
  }

  return exit(EXIT_CODES.SUCCESS);
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
    handler: makeYargsHandlerWithUsageTracking('app-secret-update', handler),
    builder,
  };

export default updateAppSecretCommand;
