import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { deleteSandbox } from '@hubspot/local-dev-lib/api/sandboxHubs';
import {
  getEnv,
  removeSandboxAccountFromConfig,
  updateDefaultAccount,
  getAccountId,
  getConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { getValidEnv } from '@hubspot/local-dev-lib/environment';

import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { logError, debugError } from '../../lib/errorHandlers/index';
import { i18n } from '../../lib/lang';
import { deleteSandboxPrompt } from '../../lib/prompts/sandboxesPrompt';
import { selectAccountFromConfig } from '../../lib/prompts/accountsPrompt';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { promptUser } from '../../lib/prompts/promptUtils';
import {
  uiAccountDescription,
  uiBetaTag,
  uiCommandReference,
} from '../../lib/ui';
import {
  CommonArgs,
  ConfigArgs,
  AccountArgs,
  EnvironmentArgs,
  TestingArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.sandbox.subcommands.delete';

export const command = 'delete';
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type CombinedArgs = ConfigArgs & AccountArgs & EnvironmentArgs & TestingArgs;
type SandboxDeleteArgs = CommonArgs &
  CombinedArgs & { account?: string; force?: boolean };

export async function handler(
  args: ArgumentsCamelCase<SandboxDeleteArgs>
): Promise<void> {
  const { providedAccountId, force } = args;

  trackCommandUsage('sandbox-delete', {}, providedAccountId);

  let accountPrompt;
  if (!providedAccountId) {
    if (!force) {
      accountPrompt = await deleteSandboxPrompt();
    } else {
      // Account is required, throw error if force flag is present and no account is specified
      logger.log('');
      logger.error(i18n(`${i18nKey}.failure.noAccount`));
      process.exit(EXIT_CODES.ERROR);
    }
    if (!accountPrompt) {
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.noAccounts`, {
          authCommand: uiCommandReference('hs auth'),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const sandboxAccountId = getAccountId(
    providedAccountId || accountPrompt!.account
  );

  if (!sandboxAccountId) {
    logger.error(i18n(`${i18nKey}.failure.noSandboxAccountId`));
    process.exit(EXIT_CODES.ERROR);
  }

  const isDefaultAccount = sandboxAccountId === getAccountId();

  const baseUrl = getHubSpotWebsiteOrigin(
    getValidEnv(getEnv(sandboxAccountId))
  );

  let parentAccountId;
  const accountsList = getConfigAccounts() || [];

  for (const portal of accountsList) {
    if (getAccountIdentifier(portal) === sandboxAccountId) {
      if (portal.parentAccountId) {
        parentAccountId = portal.parentAccountId;
      } else if (!force) {
        const parentAccountPrompt = await deleteSandboxPrompt(true);
        if (!parentAccountPrompt) {
          logger.error(i18n(`${i18nKey}.failure.noParentAccount`));
          process.exit(EXIT_CODES.ERROR);
        }
        parentAccountId = getAccountId(parentAccountPrompt.account);
      } else {
        logger.error(i18n(`${i18nKey}.failure.noParentAccount`));
        process.exit(EXIT_CODES.ERROR);
      }
    }
  }

  const url = `${baseUrl}/sandboxes/${parentAccountId}`;
  const command = `hs auth ${
    getEnv(sandboxAccountId) === 'qa' ? '--qa' : ''
  } --account=${parentAccountId}`;

  if (parentAccountId && !getAccountId(parentAccountId)) {
    logger.log('');
    logger.error(
      i18n(`${i18nKey}.failure.noParentPortalAvailable`, {
        parentAccountId,
        url,
        command,
      })
    );
    logger.log('');
    process.exit(EXIT_CODES.ERROR);
  }

  logger.debug(
    i18n(`${i18nKey}.debug.deleting`, {
      account: uiAccountDescription(sandboxAccountId),
    })
  );

  if (isDefaultAccount) {
    logger.info(
      i18n(`${i18nKey}.defaultAccountWarning`, {
        account: uiAccountDescription(sandboxAccountId),
      })
    );
    logger.log('');
  }

  try {
    if (!force) {
      const { confirmSandboxDeletePrompt: confirmed } = await promptUser([
        {
          name: 'confirmSandboxDeletePrompt',
          type: 'confirm',
          message: i18n(`${i18nKey}.confirm`, {
            account: uiAccountDescription(sandboxAccountId),
          }),
        },
      ]);
      if (!confirmed) {
        process.exit(EXIT_CODES.SUCCESS);
      }
    }

    await deleteSandbox(parentAccountId!, sandboxAccountId);

    const deleteKey = isDefaultAccount
      ? `${i18nKey}.success.deleteDefault`
      : `${i18nKey}.success.delete`;
    logger.log('');
    logger.success(
      i18n(deleteKey, {
        account: providedAccountId || accountPrompt!.account,
        sandboxHubId: sandboxAccountId || '',
      })
    );
    logger.log('');

    const promptDefaultAccount =
      removeSandboxAccountFromConfig(sandboxAccountId);
    if (promptDefaultAccount && !force) {
      const newDefaultAccount = await selectAccountFromConfig();
      updateDefaultAccount(newDefaultAccount);
    } else {
      // If force is specified, skip prompt and set the parent account id as the default account
      updateDefaultAccount(parentAccountId!);
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    debugError(err);

    if (isSpecifiedError(err, { statusCode: 401 })) {
      // Intercept invalid key error
      // This command uses the parent portal PAK to delete a sandbox, so we must specify which account needs a new key
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.invalidKey`, {
          account: uiAccountDescription(parentAccountId),
        })
      );
    } else if (
      isSpecifiedError(err, {
        statusCode: 403,
        category: 'BANNED',
        subCategory: 'SandboxErrors.USER_ACCESS_NOT_ALLOWED',
      })
    ) {
      logger.log('');
      logger.error(
        i18n(`${i18nKey}.failure.invalidUser`, {
          accountName: uiAccountDescription(sandboxAccountId),
          parentAccountName: uiAccountDescription(parentAccountId),
        })
      );
      logger.log('');
    } else if (
      isSpecifiedError(err, {
        statusCode: 404,
        category: 'OBJECT_NOT_FOUND',
        subCategory: 'SandboxErrors.SANDBOX_NOT_FOUND',
      })
    ) {
      logger.log('');
      logger.warn(
        i18n(`${i18nKey}.failure.objectNotFound`, {
          account: uiAccountDescription(sandboxAccountId),
        })
      );
      logger.log('');

      const promptDefaultAccount =
        removeSandboxAccountFromConfig(sandboxAccountId);
      if (promptDefaultAccount && !force) {
        const newDefaultAccount = await selectAccountFromConfig();
        updateDefaultAccount(newDefaultAccount);
      } else {
        // If force is specified, skip prompt and set the parent account id as the default account
        updateDefaultAccount(parentAccountId!);
      }
      process.exit(EXIT_CODES.SUCCESS);
    } else {
      logError(err);
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

export function builder(yargs: Argv): Argv<SandboxDeleteArgs> {
  yargs.option('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });
  yargs.option('force', {
    type: 'boolean',
    alias: 'f',
    describe: i18n(`${i18nKey}.options.force.describe`),
  });

  yargs.example([
    [
      '$0 sandbox delete --account=MySandboxAccount',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  return yargs as Argv<SandboxDeleteArgs>;
}
