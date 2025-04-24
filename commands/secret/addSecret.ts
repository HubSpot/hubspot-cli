import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { addSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';

import { logError, ApiErrorContext } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';
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
} from '../../types/Yargs';

export const command = 'add [name]';
export const describe = i18n(`commands.secret.subcommands.add.describe`);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs;
type AddSecretArgs = CommonArgs & CombinedArgs & { name?: string };

export async function handler(
  args: ArgumentsCamelCase<AddSecretArgs>
): Promise<void> {
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

export function builder(yargs: Argv): Argv<AddSecretArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.positional('name', {
    describe: i18n(`commands.secret.subcommands.add.positionals.name.describe`),
    type: 'string',
  });

  return yargs as Argv<AddSecretArgs>;
}
