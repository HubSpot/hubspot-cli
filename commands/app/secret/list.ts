import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchAppSecrets } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
//import { uiAccountDescription } from '../../../lib/ui';
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

const command = 'list';
const describe = commands.app.subcommands.secret.subcommands.list.describe;

type ListAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { appId?: number };

async function handler(
  args: ArgumentsCamelCase<ListAppSecretArgs>
): Promise<void> {
  const { appId, derivedAccountId } = args;
  let appSecretAppId = appId;

  trackCommandUsage('app-secret-list', {}, derivedAccountId);

  try {
    const { appId: appIdPromptValue } = await promptUser({
      name: 'appId',
      message: commands.app.subcommands.secret.subcommands.list.appIdPrompt,
      type: 'number',
      when: !appSecretAppId,
    });

    if (appIdPromptValue) {
      appSecretAppId = appIdPromptValue;
    }

    if (!appSecretAppId) {
      logger.error(commands.app.subcommands.secret.subcommands.list.error);
      process.exit(EXIT_CODES.ERROR);
    }

    const secrets = await fetchAppSecrets(derivedAccountId, appSecretAppId);

    logger.success('yay: ', secrets);
  } catch (err) {
    logError(err);
    process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function listAppSecretBuilder(yargs: Argv): Argv<ListAppSecretArgs> {
  yargs.option('app-id', {
    describe: commands.app.subcommands.secret.subcommands.list.options.appId,
    type: 'number',
  });

  yargs.example(
    'list --app-id=1234567890',
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
