import fs from 'fs-extra';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import { getConfigPath, getAccountId } from '@hubspot/local-dev-lib/config';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { logError } from '../../lib/errorHandlers/index';
import { CommonArgs, ConfigArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.createOverride';

export const describe = null; // i18n(`${i18nKey}.describe`);

export const command = 'create-override [account]';

type AccountCreateOverrideArgs = CommonArgs &
  ConfigArgs & {
    account: string | number;
  };

export async function handler(
  args: ArgumentsCamelCase<AccountCreateOverrideArgs>
): Promise<void> {
  let overrideDefaultAccount = args.account;

  if (!overrideDefaultAccount) {
    overrideDefaultAccount = await selectAccountFromConfig();
  } else if (!getAccountId(overrideDefaultAccount)) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        configPath: getConfigPath() || '',
      })
    );
    overrideDefaultAccount = await selectAccountFromConfig();
  }
  const accountId = getAccountId(overrideDefaultAccount);

  try {
    const overrideFilePath = path.join(
      getCwd(),
      DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME
    );
    await fs.writeFile(overrideFilePath, accountId!.toString(), 'utf8');
    logger.success(i18n(`${i18nKey}.success`, { overrideFilePath }));
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e: unknown) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<AccountCreateOverrideArgs> {
  addConfigOptions(yargs);

  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.example([
    ['$0 account create-override', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 account create-override 12345678',
      i18n(`${i18nKey}.examples.idBased`),
    ],
    [
      '$0 account create-override MyAccount',
      i18n(`${i18nKey}.examples.nameBased`),
    ],
  ]);

  return yargs as Argv<AccountCreateOverrideArgs>;
}
