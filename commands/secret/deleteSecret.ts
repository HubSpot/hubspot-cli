import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { deleteSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';

import { secretListPrompt } from '../../lib/prompts/secretPrompt';
import { confirmPrompt } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiAccountDescription } from '../../lib/ui';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.secret.subcommands.delete';

export const command = 'delete [name]';
export const describe = i18n(`${i18nKey}.describe`);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs;
type DeleteSecretArgs = CommonArgs &
  CombinedArgs & { name?: string; force?: boolean };

export async function handler(
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
      logger.error(i18n(`${i18nKey}.errors.noSecret`, { secretName }));
      process.exit(EXIT_CODES.ERROR);
    }

    if (!secretName) {
      const { secretToModify } = await secretListPrompt(
        secrets,
        i18n(`${i18nKey}.selectSecret`)
      );
      secretName = secretToModify;
    }

    const confirmDelete =
      force ||
      (await confirmPrompt(i18n(`${i18nKey}.confirmDelete`, { secretName }), {
        defaultAnswer: false,
      }));

    if (!confirmDelete) {
      logger.success(i18n(`${i18nKey}.deleteCanceled`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    await deleteSecret(derivedAccountId, secretName);
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        secretName,
      })
    );
  } catch (err) {
    if (secretName) {
      logger.error(
        i18n(`${i18nKey}.errors.delete`, {
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

export function builder(yargs: Argv): Argv<DeleteSecretArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs
    .positional('name', {
      describe: i18n(`${i18nKey}.positionals.name.describe`),
      type: 'string',
    })
    .options('force', {
      describe: 'Force the deletion',
      type: 'boolean',
    });

  return yargs as Argv<DeleteSecretArgs>;
}
