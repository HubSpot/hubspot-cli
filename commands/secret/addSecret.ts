import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { addSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiAccountDescription } from '../../lib/ui';
import {
  secretValuePrompt,
  secretNamePrompt,
} from '../../lib/prompts/secretPrompt';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { uiCommandReference } from '../../lib/ui';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'add [name]';
const describe = i18n(`commands.secret.subcommands.add.describe`);

type AddSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string };

async function handler(args: ArgumentsCamelCase<AddSecretArgs>): Promise<void> {
  const { name, derivedAccountId } = args;
  let secretName = name;

  trackCommandUsage('secrets-add', {}, derivedAccountId);

  try {
    if (!secretName) {
      const { secretName: name } = await secretNamePrompt(
        i18n(`commands.secret.subcommands.add.actionType`)
      );
      secretName = name;
    }

    const {
      data: { results: secrets },
    } = await fetchSecrets(derivedAccountId);

    if (secrets.includes(secretName)) {
      logger.error(
        i18n(`commands.secret.subcommands.add.errors.alreadyExists`, {
          secretName,
          command: uiCommandReference('hs secret update'),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }

    const { secretValue } = await secretValuePrompt();

    await addSecret(derivedAccountId, secretName, secretValue);
    logger.success(
      i18n(`commands.secret.subcommands.add.success.add`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        secretName,
      })
    );
  } catch (err) {
    logger.error(
      i18n(`commands.secret.subcommands.add.errors.add`, {
        secretName: secretName || '',
      })
    );
    logError(
      err,
      new ApiErrorContext({
        request: 'add secret',
        accountId: derivedAccountId,
      })
    );
  }
}

function addSecretBuilder(yargs: Argv): Argv<AddSecretArgs> {
  yargs.positional('name', {
    describe: i18n(`commands.secret.subcommands.add.positionals.name.describe`),
    type: 'string',
  });

  return yargs as Argv<AddSecretArgs>;
}

const builder = makeYargsBuilder<AddSecretArgs>(
  addSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const addSecretCommand: YargsCommandModule<unknown, AddSecretArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default addSecretCommand;
