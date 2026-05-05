import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getConfigFilePath,
  setConfigAccountAsDefault,
  getConfigAccountIfExists,
  getConfigAccountByName,
  getConfigAccountById,
  globalConfigFileExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import {
  getDefaultAccountOverrideAccountId,
  getDefaultAccountOverrideFilePath,
} from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import {
  getHsSettingsFileIfExists,
  getHsSettingsFilePath,
  writeHsSettingsFile,
} from '@hubspot/local-dev-lib/config/hsSettings';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import {
  selectAccountFromConfig,
  AUTHENTICATE_NEW_ACCOUNT_VALUE,
} from '../../lib/prompts/accountsPrompt.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { authenticateNewAccount } from '../../lib/accountAuth.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import { handleLinkedUseAction } from '../../lib/link/index.js';
import { isDirectoryLinked } from '../../lib/link/linkUtils.js';
import { ACTION_RESULT_STATUS } from '../../types/Link.js';
import { DEFAULT_HS_SETTINGS_PATH } from '@hubspot/local-dev-lib/constants/config';

const command = 'use [account]';
const describe = commands.account.subcommands.use.describe;

type AccountUseArgs = CommonArgs & {
  account?: string;
};

async function handleLinkedUse(
  args: ArgumentsCamelCase<AccountUseArgs>,
  hsSettings: { accounts: number[]; localDefaultAccount: number | undefined }
): Promise<void> {
  const { exit } = args;
  uiLogger.log(
    commands.account.subcommands.use.linked.editingLinkedDefault(getCwd())
  );
  uiLogger.log('');

  if (!args.account && hsSettings.accounts.length === 1) {
    uiLogger.log(
      commands.account.subcommands.use.linked.alreadyDefault(
        hsSettings.accounts[0]
      )
    );
    return exit(EXIT_CODES.SUCCESS);
  }

  let targetAccountId: number | undefined;

  if (args.account) {
    const account = getConfigAccountIfExists(args.account);
    if (!account) {
      uiLogger.error(
        commands.account.subcommands.use.errors.accountNotFound(
          args.account,
          getConfigFilePath()
        )
      );
      return exit(EXIT_CODES.ERROR);
    }

    if (!hsSettings.accounts.includes(account.accountId)) {
      if (!process.stdin.isTTY) {
        uiLogger.log(
          commands.account.subcommands.use.linked.nonInteractiveNotLinked(
            account.name
          )
        );
        setConfigAccountAsDefault(String(args.account));
        uiLogger.success(
          commands.account.subcommands.use.success.defaultAccountUpdated(
            account.name
          )
        );
        return exit(EXIT_CODES.SUCCESS);
      }

      uiLogger.log(
        commands.account.subcommands.use.linked.accountNotLinked(account.name)
      );
      const shouldLink = await confirmPrompt(
        commands.account.subcommands.use.linked.promptToLink(account.name)
      );

      if (!shouldLink) {
        uiLogger.log(
          commands.account.subcommands.use.linked.settingGlobalDefault
        );
        setConfigAccountAsDefault(String(args.account));
        uiLogger.success(
          commands.account.subcommands.use.success.defaultAccountUpdated(
            account.name
          )
        );
        return exit(EXIT_CODES.SUCCESS);
      }
    }

    targetAccountId = account.accountId;
  }

  const result = await handleLinkedUseAction({
    state: hsSettings,
    targetAccountId,
  });

  if (result.status === ACTION_RESULT_STATUS.ERROR) {
    uiLogger.error(result.reason);
    return exit(EXIT_CODES.ERROR);
  }
  if (result.status === ACTION_RESULT_STATUS.NOOP) {
    return exit(EXIT_CODES.SUCCESS);
  }

  const settingsPath = getHsSettingsFilePath() || DEFAULT_HS_SETTINGS_PATH;

  try {
    writeHsSettingsFile(result.settings);
  } catch (err) {
    uiLogger.error(
      commands.account.subcommands.link.shared.writeSettingsFailed(
        settingsPath,
        err
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.success(
    commands.account.subcommands.link.shared.savedToSettings(settingsPath)
  );
  return exit(EXIT_CODES.SUCCESS);
}

async function handleGlobalUse(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  const { exit } = args;
  let newDefaultAccount: string | number | undefined = args.account;
  const usingGlobalConfig = globalConfigFileExists();

  if (!newDefaultAccount) {
    newDefaultAccount = await selectAccountFromConfig('', usingGlobalConfig);
  } else {
    const account = getConfigAccountIfExists(newDefaultAccount);
    if (!account) {
      uiLogger.error(
        commands.account.subcommands.use.errors.accountNotFound(
          newDefaultAccount,
          getConfigFilePath()
        )
      );
      newDefaultAccount = await selectAccountFromConfig('', usingGlobalConfig);
    }
  }

  if (newDefaultAccount === AUTHENTICATE_NEW_ACCOUNT_VALUE) {
    const updatedConfig = await authenticateNewAccount({
      env: args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD,
      setAsDefaultAccount: true,
    });

    if (!updatedConfig) {
      return exit(EXIT_CODES.ERROR);
    }

    return;
  }

  let account: HubSpotConfigAccount;

  if (!isNaN(Number(newDefaultAccount))) {
    account = getConfigAccountById(Number(newDefaultAccount));
  } else {
    account = getConfigAccountByName(String(newDefaultAccount));
  }

  const accounts = getAllConfigAccounts();
  const accountOverride = getDefaultAccountOverrideAccountId(accounts);
  const overrideFilePath = getDefaultAccountOverrideFilePath();
  if (accountOverride && overrideFilePath) {
    uiLogger.warn(
      commands.account.subcommands.use.accountOverride(
        accountOverride.toString()
      )
    );
    uiLogger.log(commands.account.subcommands.use.accountOverrideCommands);
    uiLogger.log('');
  }

  setConfigAccountAsDefault(String(newDefaultAccount));

  return uiLogger.success(
    commands.account.subcommands.use.success.defaultAccountUpdated(account.name)
  );
}

async function handler(
  args: ArgumentsCamelCase<AccountUseArgs>
): Promise<void> {
  const hsSettings = getHsSettingsFileIfExists();
  const isLinked = isDirectoryLinked(hsSettings);

  if (isLinked) {
    return handleLinkedUse(args, hsSettings);
  }

  return handleGlobalUse(args);
}

function accountUseBuilder(yargs: Argv): Argv<AccountUseArgs> {
  yargs.positional('account', {
    describe: commands.account.subcommands.use.options.account.describe,
    type: 'string',
  });

  yargs.example([
    ['$0 accounts use', commands.account.subcommands.use.examples.default],
    [
      '$0 accounts use MyAccount',
      commands.account.subcommands.use.examples.nameBased,
    ],
    [
      '$0 accounts use 1234567',
      commands.account.subcommands.use.examples.idBased,
    ],
  ]);

  return yargs as Argv<AccountUseArgs>;
}

const builder = makeYargsBuilder<AccountUseArgs>(
  accountUseBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const accountUseCommand: YargsCommandModule<unknown, AccountUseArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('accounts-use', handler),
  builder,
};

export default accountUseCommand;
