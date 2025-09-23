import { Argv, ArgumentsCamelCase } from 'yargs';
import { addSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { logError, ApiErrorContext } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import {
  secretValuePrompt,
  secretNamePrompt,
} from '../../lib/prompts/secretPrompt.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'add [name]';
const describe = commands.secret.subcommands.add.describe;

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
      const { secretName: name } = await secretNamePrompt();
      secretName = name;
    }

    const {
      data: { results: secrets },
    } = await fetchSecrets(derivedAccountId);

    if (secrets.includes(secretName)) {
      uiLogger.error(
        commands.secret.subcommands.add.errors.alreadyExists(secretName)
      );
      process.exit(EXIT_CODES.ERROR);
    }

    const { secretValue } = await secretValuePrompt();

    await addSecret(derivedAccountId, secretName, secretValue);
    uiLogger.success(
      commands.secret.subcommands.add.success.add(secretName, derivedAccountId)
    );
  } catch (err) {
    uiLogger.error(
      commands.secret.subcommands.add.errors.add(secretName || '')
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
    describe: commands.secret.subcommands.add.positionals.name.describe,
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
