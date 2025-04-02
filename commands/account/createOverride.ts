import fs from 'fs-extra';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { logger } from '@hubspot/local-dev-lib/logger';
import { DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME } from '@hubspot/local-dev-lib/constants/config';
import {
  getCWDAccountOverride,
  getDefaultAccountOverrideFilePath,
  getConfigPath,
  getAccountId,
} from '@hubspot/local-dev-lib/config';

import { i18n } from '../../lib/lang';
import { promptUser } from '../../lib/prompts/promptUtils';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { trackCommandMetadataUsage } from '../../lib/usageTracking';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { logError } from '../../lib/errorHandlers/index';
import { CommonArgs } from '../../types/Yargs';

const i18nKey = 'commands.account.subcommands.createOverride';

export const describe = i18n(`${i18nKey}.describe`, {
  hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
});

export const command = 'create-override [account]';

type AccountCreateOverrideArgs = CommonArgs & {
  account: string | number;
};

export async function handler(
  args: ArgumentsCamelCase<AccountCreateOverrideArgs>
): Promise<void> {
  let overrideDefaultAccount = args.account;

  const accountOverride = getCWDAccountOverride();
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    logger.log(
      i18n(`${i18nKey}.accountOverride`, {
        accountOverride,
        overrideFilePath,
      })
    );

    const { replaceOverrideFile } = await promptUser({
      type: 'confirm',
      name: 'replaceOverrideFile',
      message: i18n(`${i18nKey}.prompts.replaceOverrideFile`),
    });
    logger.log('');

    if (!replaceOverrideFile) {
      const accountId = getAccountId(accountOverride) || undefined;
      trackCommandMetadataUsage(
        'account-createOverride',
        {
          command: 'hs account create-override',
          step: 'Reject overwriting an override via prompt',
        },
        accountId
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

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
    const trackingId = accountId || undefined;
    trackCommandMetadataUsage(
      'config-migrate',
      {
        command: 'hs config migrate',
        step: 'Confirm overwriting an override via prompt',
        successful: true,
      },
      trackingId
    );
    process.exit(EXIT_CODES.SUCCESS);
  } catch (e: unknown) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<AccountCreateOverrideArgs> {
  yargs.positional('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.example([
    [
      '$0 account create-override',
      i18n(`${i18nKey}.examples.default`, {
        hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
      }),
    ],
    [
      '$0 account create-override 12345678',
      i18n(`${i18nKey}.examples.idBased`, {
        hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
      }),
    ],
    [
      '$0 account create-override MyAccount',
      i18n(`${i18nKey}.examples.nameBased`, {
        hsAccountFileName: DEFAULT_ACCOUNT_OVERRIDE_FILE_NAME,
      }),
    ],
  ]);

  return yargs as Argv<AccountCreateOverrideArgs>;
}
