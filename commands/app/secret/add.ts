import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { addAppSecret } from '@hubspot/local-dev-lib/api/devSecrets';
import { logError } from '../../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { uiAccountDescription } from '../../../lib/ui';
import {
  secretValuePrompt,
  secretNamePrompt,
} from '../../../lib/prompts/secretPrompt';
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

export const command = 'add [name]';
export const describe = i18n(
  `commands.app.subcommands.secret.subcommands.add.describe`
);

type AddAppSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; appId: number };

export async function handler(
  args: ArgumentsCamelCase<AddAppSecretArgs>
): Promise<void> {
  const { appId, name, derivedAccountId } = args;
  let appSecretName = name;
  let appSecretAppId = appId;

  trackCommandUsage('app-secret-add', {}, derivedAccountId);

  try {
    const { appId: appIdPromptValue } = await promptUser({
      name: 'appId',
      message: i18n(
        `commands.app.subcommands.secret.subcommands.add.appIdPrompt`
      ),
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

    const { secretValue } = await secretValuePrompt();

    await addAppSecret(
      derivedAccountId,
      appSecretAppId,
      appSecretName,
      secretValue
    );

    logger.success(
      i18n(`commands.app.subcommands.secret.subcommands.add.success`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        appSecretName,
      })
    );
  } catch (err) {
    logError(err);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function addAppSecretBuilder(yargs: Argv): Argv<AddAppSecretArgs> {
  yargs.positional('name', {
    describe: i18n(
      `commands.app.subcommands.secret.subcommands.add.positionals.name.describe`
    ),
    type: 'string',
  });

  yargs.option('app-id', {
    describe: i18n(
      `commands.app.subcommands.secret.subcommands.add.options.appId.describe`
    ),
    type: 'number',
    required: true,
  });

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
