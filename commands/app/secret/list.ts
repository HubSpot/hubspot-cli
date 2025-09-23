import { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchAppSecrets } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
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
import { selectAppPrompt } from '../../../lib/prompts/selectAppPrompt.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { uiBetaTag } from '../../../lib/ui/index.js';

const command = 'list';
const describe = uiBetaTag(
  commands.app.subcommands.secret.subcommands.list.describe,
  false
);

type ListAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { app?: number };

async function handler(
  args: ArgumentsCamelCase<ListAppSecretArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('app-secret-list', {}, derivedAccountId);

  const appSecretApp = await selectAppPrompt(derivedAccountId, args.app);

  if (!appSecretApp) {
    process.exit(EXIT_CODES.ERROR);
  }

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
    uiLogger.log('');
    uiLogger.log(
      commands.app.subcommands.secret.subcommands.list.errors.noSecrets
    );
  } else {
    uiLogger.log('');
    uiLogger.log(
      commands.app.subcommands.secret.subcommands.list.success(
        appSecretApp.name
      )
    );

    appSecrets.forEach(secret => {
      uiLogger.log(`- ${secret}`);
    });
  }

  process.exit(EXIT_CODES.SUCCESS);
}

function listAppSecretBuilder(yargs: Argv): Argv<ListAppSecretArgs> {
  yargs.option('app', {
    describe: commands.app.subcommands.secret.subcommands.list.options.app,
    type: 'number',
  });

  yargs.example(
    'list --app=1234567890',
    commands.app.subcommands.secret.subcommands.list.example
  );

  return yargs as Argv<ListAppSecretArgs>;
}

const builder = makeYargsBuilder<ListAppSecretArgs>(
  listAppSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useAccountOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const listAppSecretCommand: YargsCommandModule<unknown, ListAppSecretArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default listAppSecretCommand;
