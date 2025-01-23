import fs from 'fs-extra';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getConfigPath, getAccountId } from '@hubspot/local-dev-lib/config';
import { addConfigOptions } from '../../lib/commonOpts';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { CommonArgs, ConfigOptions } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.createOverride';

export const describe = null; // i18n(`${i18nKey}.describe`);

export const command = 'create-override [account]';

type AccountInfoArgs = CommonArgs &
  ConfigOptions & {
    account?: string | number;
  };

export async function handler(
  args: ArgumentsCamelCase<AccountInfoArgs>
): Promise<void> {
  let overrideDefaultAccount = args.account;

  if (!overrideDefaultAccount) {
    overrideDefaultAccount = await selectAccountFromConfig();
  } else if (
    (typeof overrideDefaultAccount !== 'string' &&
      typeof overrideDefaultAccount !== 'number') ||
    !getAccountId(overrideDefaultAccount)
  ) {
    logger.error(
      i18n(`${i18nKey}.errors.accountNotFound`, {
        configPath: getConfigPath() || '',
      })
    );
    overrideDefaultAccount = await selectAccountFromConfig();
  }
  const accountId = getAccountId(overrideDefaultAccount);

  try {
    const overrideFilePath = path.join(getCwd(), '.hs-account');
    await fs.writeFile(overrideFilePath, accountId!.toString(), 'utf8');
    logger.success(i18n(`${i18nKey}.success`, { overrideFilePath }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      logger.error(i18n(`${i18nKey}.errors.writeFile`, { error: e.message }));
    } else {
      logger.error(i18n(`${i18nKey}.errors.writeFile`, { error: String(e) }));
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<AccountInfoArgs> {
  addConfigOptions(yargs);

  yargs.example([
    ['$0 accounts create-override', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 accounts create-override 12345678',
      i18n(`${i18nKey}.examples.idBased`),
    ],
    [
      '$0 accounts create-override MyAccount',
      i18n(`${i18nKey}.examples.nameBased`),
    ],
  ]);

  return yargs as Argv<AccountInfoArgs>;
}
