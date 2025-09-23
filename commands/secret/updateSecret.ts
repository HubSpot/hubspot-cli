import { Argv, ArgumentsCamelCase } from 'yargs';
import { updateSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import {
  secretValuePrompt,
  secretListPrompt,
} from '../../lib/prompts/secretPrompt.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'update [name]';
const describe = commands.secret.subcommands.update.describe;

type UpdateSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string };

async function handler(
  args: ArgumentsCamelCase<UpdateSecretArgs>
): Promise<void> {
  const { name, derivedAccountId } = args;
  let secretName = name;

  trackCommandUsage('secrets-update', {}, derivedAccountId);

  try {
    const {
      data: { results: secrets },
    } = await fetchSecrets(derivedAccountId);

    if (secretName && !secrets.includes(secretName)) {
      uiLogger.error(
        commands.secret.subcommands.update.errors.noSecret(secretName)
      );
      process.exit(EXIT_CODES.ERROR);
    }

    if (!secretName) {
      const { secretToModify } = await secretListPrompt(
        secrets,
        commands.secret.subcommands.update.selectSecret
      );
      secretName = secretToModify;
    }

    const { secretValue } = await secretValuePrompt();

    await updateSecret(derivedAccountId, secretName, secretValue);
    uiLogger.success(
      commands.secret.subcommands.update.success.update(
        secretName,
        derivedAccountId
      )
    );
    uiLogger.log(commands.secret.subcommands.update.success.updateExplanation);
  } catch (err) {
    uiLogger.error(
      commands.secret.subcommands.update.errors.update(secretName || '')
    );
    logError(
      err,
      new ApiErrorContext({
        request: 'update secret',
        accountId: derivedAccountId,
      })
    );
  }
}

function updateSecretBuilder(yargs: Argv): Argv<UpdateSecretArgs> {
  yargs.positional('name', {
    describe: commands.secret.subcommands.update.positionals.name.describe,
    type: 'string',
  });

  return yargs as Argv<UpdateSecretArgs>;
}

const builder = makeYargsBuilder<UpdateSecretArgs>(
  updateSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const updateSecretCommand: YargsCommandModule<unknown, UpdateSecretArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default updateSecretCommand;
