import { Argv, ArgumentsCamelCase } from 'yargs';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { PERSONAL_ACCESS_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { deleteConfigFileIfEmpty } from '@hubspot/local-dev-lib/config';
import { handleExit } from '../../lib/process.js';
import { trackAuthAction } from '../../lib/usageTracking.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiFeatureHighlight } from '../../lib/ui/index.js';
import { parseStringToNumber } from '../../lib/parsing.js';
import {
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { authenticateNewAccount } from '../../lib/accountAuth.js';

const TRACKING_STATUS = {
  STARTED: 'started',
  ERROR: 'error',
  COMPLETE: 'complete',
};
const authType = PERSONAL_ACCESS_KEY_AUTH_METHOD.value;

const describe = commands.account.subcommands.auth.describe;
const command = 'auth';

type AccountAuthArgs = CommonArgs &
  ConfigArgs & {
    disableTracking?: boolean;
  } & { personalAccessKey?: string };

async function handler(
  args: ArgumentsCamelCase<AccountAuthArgs>
): Promise<void> {
  const {
    disableTracking,
    personalAccessKey: providedPersonalAccessKey,
    userProvidedAccount,
    exit,
  } = args;

  let parsedUserProvidedAccountId: number | undefined;

  if (userProvidedAccount) {
    try {
      parsedUserProvidedAccountId = parseStringToNumber(userProvidedAccount);
    } catch (err) {
      uiLogger.error(
        commands.account.subcommands.auth.errors.invalidAccountIdProvided
      );
      return exit(EXIT_CODES.ERROR);
    }
  }

  if (!disableTracking) {
    await trackAuthAction('account-auth', authType, TRACKING_STATUS.STARTED);
  }

  handleExit(deleteConfigFileIfEmpty);

  const updatedConfig = await authenticateNewAccount({
    env: args.qa ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD,
    providedPersonalAccessKey,
    accountId: parsedUserProvidedAccountId,
  });

  if (!updatedConfig) {
    if (!disableTracking) {
      await trackAuthAction('account-auth', authType, TRACKING_STATUS.ERROR);
    }

    return exit(EXIT_CODES.ERROR);
  }

  const { accountId } = updatedConfig;

  uiFeatureHighlight([
    'getStartedCommand',
    'helpCommand',
    'accountAuthCommand',
    'accountsListCommand',
  ]);

  if (!disableTracking) {
    await trackAuthAction(
      'account-auth',
      authType,
      TRACKING_STATUS.COMPLETE,
      accountId
    );
  }

  return exit(EXIT_CODES.SUCCESS);
}

function accountAuthBuilder(yargs: Argv): Argv<AccountAuthArgs> {
  yargs.options({
    account: {
      describe: commands.account.subcommands.auth.options.account,
      type: 'number',
      alias: 'a',
    },
    'disable-tracking': {
      type: 'boolean',
      hidden: true,
      default: false,
    },
    'personal-access-key': {
      describe: commands.account.subcommands.auth.options.personalAccessKey,
      type: 'string',
      hidden: false,
      alias: 'pak',
    },
  });

  return yargs as Argv<AccountAuthArgs>;
}

const builder = makeYargsBuilder<AccountAuthArgs>(
  accountAuthBuilder,
  command,
  commands.account.subcommands.auth.verboseDescribe,
  {
    useGlobalOptions: true,
    useTestingOptions: true,
  }
);

const accountAuthCommand: YargsCommandModule<unknown, AccountAuthArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('account-auth', handler),
  builder,
};

export default accountAuthCommand;
