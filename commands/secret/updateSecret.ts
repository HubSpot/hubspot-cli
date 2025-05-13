import { Argv, ArgumentsCamelCase } from 'yargs';
import { updateSecret, fetchSecrets } from '@hubspot/local-dev-lib/api/secrets';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { logger } from '@hubspot/local-dev-lib/logger';
import { ApiErrorContext, logError } from '../../lib/errorHandlers/index';
import { trackCommandUsage } from '../../lib/usageTracking';
import { uiAccountDescription } from '../../lib/ui';
import {
  secretValuePrompt,
  secretListPrompt,
} from '../../lib/prompts/secretPrompt';
import { i18n } from '../../lib/lang';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'update [name]';
const describe = i18n(`commands.secret.subcommands.update.describe`);

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
      logger.error(
        i18n(`commands.secret.subcommands.update.errors.noSecret`, {
          secretName,
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }

    if (!secretName) {
      const { secretToModify } = await secretListPrompt(
        secrets,
        i18n(`commands.secret.subcommands.update.selectSecret`)
      );
      secretName = secretToModify;
    }

    const { secretValue } = await secretValuePrompt();

    await updateSecret(derivedAccountId, secretName, secretValue);
    logger.success(
      i18n(`commands.secret.subcommands.update.success.update`, {
        accountIdentifier: uiAccountDescription(derivedAccountId),
        secretName,
      })
    );
    logger.log(
      i18n(`commands.secret.subcommands.update.success.updateExplanation`)
    );
  } catch (err) {
    logger.error(
      i18n(`commands.secret.subcommands.update.errors.update`, {
        secretName: secretName || '',
      })
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
    describe: i18n(
      `commands.secret.subcommands.update.positionals.name.describe`
    ),
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
