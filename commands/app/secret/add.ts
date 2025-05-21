import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { addAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
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

const command = 'add [name]';
const describe = commands.app.subcommands.secret.subcommands.add.describe;

type AddAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; appId?: number };

async function handler(
  args: ArgumentsCamelCase<AddAppSecretArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('app-secret-add', {}, derivedAccountId);

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.appId);

  let appSecretName = args.name;

  if (!appSecretName) {
    const { secretName: name } = await secretNamePrompt();
    appSecretName = name;
  }

  const { secretValue } = await secretValuePrompt();

  try {
    await addAppSecret(
      derivedAccountId,
      appSecretApp.id,
      appSecretName,
      secretValue
    );

    logger.success(
      commands.app.subcommands.secret.subcommands.add.success(
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

function addAppSecretBuilder(yargs: Argv): Argv<AddAppSecretArgs> {
  yargs.positional('name', {
    describe: commands.app.subcommands.secret.subcommands.add.positionals.name,
    type: 'string',
  });

  yargs.option('app-id', {
    describe: commands.app.subcommands.secret.subcommands.add.options.appId,
    type: 'number',
  });

  yargs.example(
    'add my-secret --app-id=1234567890',
    commands.app.subcommands.secret.subcommands.add.example
  );

  return yargs as Argv<AddAppSecretArgs>;
}

const builder = makeYargsBuilder<AddAppSecretArgs>(
  addAppSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const addAppSecretCommand: YargsCommandModule<unknown, AddAppSecretArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default addAppSecretCommand;
