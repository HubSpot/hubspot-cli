import { Argv, ArgumentsCamelCase } from 'yargs';
import { deleteSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { secretListPrompt } from '../../lib/prompts/secretPrompt.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from './../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'delete [name]';
const describe = commands.secret.subcommands.delete.describe;

type DeleteSecretArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { name?: string; force?: boolean };

async function handler(
  args: ArgumentsCamelCase<DeleteSecretArgs>
): Promise<void> {
  const { name, derivedAccountId, force } = args;
  let secretName = name;

  trackCommandUsage('secrets-delete', {}, derivedAccountId);

  try {
    const {
      data: { results: secrets },
    } = await fetchSecrets(derivedAccountId);

    if (secretName && !secrets.includes(secretName)) {
      uiLogger.error(
        commands.secret.subcommands.delete.errors.noSecret(secretName)
      );
      process.exit(EXIT_CODES.ERROR);
    }

    if (!secretName) {
      const { secretToModify } = await secretListPrompt(
        secrets,
        commands.secret.subcommands.delete.selectSecret
      );
      secretName = secretToModify;
    }

    const confirmDelete =
      force ||
      (await confirmPrompt(
        commands.secret.subcommands.delete.confirmDelete(secretName),
        {
          defaultAnswer: false,
        }
      ));

    if (!confirmDelete) {
      uiLogger.success(commands.secret.subcommands.delete.deleteCanceled);
      process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteSecret(derivedAccountId, secretName);
    uiLogger.success(
      commands.secret.subcommands.delete.success.delete(
        secretName,
        derivedAccountId
      )
    );
  } catch (err) {
    if (secretName) {
      uiLogger.error(
        commands.secret.subcommands.delete.errors.delete(secretName)
      );
    }
    logError(
      err,
      new ApiErrorContext({
        request: 'delete a secret',
        accountId: derivedAccountId,
      })
    );
  }
}

function deleteSecretBuilder(yargs: Argv): Argv<DeleteSecretArgs> {
  yargs
    .positional('name', {
      describe: commands.secret.subcommands.delete.positionals.name.describe,
      type: 'string',
    })
    .options('force', {
      describe: 'Force the deletion',
      type: 'boolean',
    });

  return yargs as Argv<DeleteSecretArgs>;
}

const builder = makeYargsBuilder<DeleteSecretArgs>(
  deleteSecretBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const deleteSecretCommand: YargsCommandModule<unknown, DeleteSecretArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default deleteSecretCommand;
