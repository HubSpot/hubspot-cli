import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { deleteSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { secretListPrompt } from '../../lib/prompts/secretPrompt';
import { confirmPrompt } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiAccountDescription } from '../../lib/ui';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'delete [name]';
const describe = i18n(`commands.secret.subcommands.delete.describe`);

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
      logger.error(
        i18n(`commands.secret.subcommands.delete.errors.noSecret`, {
          secretName,
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }

    if (!secretName) {
      const { secretToModify } = await secretListPrompt(
        secrets,
        i18n(`commands.secret.subcommands.delete.selectSecret`)
      );
      secretName = secretToModify;
    }

    const confirmDelete =
      force ||
      (await confirmPrompt(
        i18n(`commands.secret.subcommands.delete.confirmDelete`, {
          secretName,
        }),
        {
          defaultAnswer: false,
        }
      ));

    if (!confirmDelete) {
      logger.success(i18n(`commands.secret.subcommands.delete.deleteCanceled`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteSecret(derivedAccountId, secretName);
    logger.success(
      i18n(`commands.secret.subcommands.delete.success.delete`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        secretName,
      })
    );
  } catch (err) {
    if (secretName) {
      logger.error(
        i18n(`commands.secret.subcommands.delete.errors.delete`, {
          secretName,
        })
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
      describe: i18n(
        `commands.secret.subcommands.delete.positionals.name.describe`
      ),
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
