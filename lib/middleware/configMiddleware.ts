import { Arguments } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { CLIOptions } from '@hubspot/local-dev-lib/types/CLIOptions';
import {
  loadConfig,
  getAccountId,
  configFileExists,
  getConfigPath,
  validateConfig,
} from '@hubspot/local-dev-lib/config';
import { validateAccount } from '../validation';
import { EXIT_CODES } from '../enums/exitCodes';
import { i18n } from '../lang';
import { uiDeprecatedTag } from '../ui';
import { isTargetedCommand } from './utils';

export function handleDeprecatedEnvVariables(
  argv: Arguments<{ useEnv?: boolean }>
): void {
  // HUBSPOT_PORTAL_ID is deprecated, but we'll still support it for now
  // The HubSpot GH Deploy Action still uses HUBSPOT_PORTAL_ID
  if (
    argv.useEnv &&
    process.env.HUBSPOT_PORTAL_ID &&
    !process.env.HUBSPOT_ACCOUNT_ID
  ) {
    uiDeprecatedTag(
      i18n(
        `commands.generalErrors.handleDeprecatedEnvVariables.portalEnvVarDeprecated`,
        {
          configPath: getConfigPath()!,
        }
      )
    );
    process.env.HUBSPOT_ACCOUNT_ID = process.env.HUBSPOT_PORTAL_ID;
  }
}

/**
 * Auto-injects the derivedAccountId flag into all commands
 */
export async function injectAccountIdMiddleware(
  argv: Arguments<{ account?: string }>
): Promise<void> {
  const { account } = argv;

  // Preserves the original --account flag for certain commands.
  argv.providedAccountId = account;

  if (argv.useEnv && process.env.HUBSPOT_ACCOUNT_ID) {
    argv.derivedAccountId = parseInt(process.env.HUBSPOT_ACCOUNT_ID, 10);
  } else {
    argv.derivedAccountId = getAccountId(account);
  }
}

const SKIP_CONFIG_VALIDATION = {
  init: { target: true },
  auth: { target: true },
  'get-started': { target: true },
};

export async function loadConfigMiddleware(
  argv: Arguments<CLIOptions>
): Promise<void> {
  // Skip this when no command is provided
  if (!argv._.length || argv.help) {
    return;
  }

  const maybeValidateConfig = () => {
    if (
      !isTargetedCommand(argv._, SKIP_CONFIG_VALIDATION) &&
      !validateConfig()
    ) {
      process.exit(EXIT_CODES.ERROR);
    }
  };

  if (
    !configFileExists(true) &&
    isTargetedCommand(argv._, {
      account: { target: false, subCommands: { auth: { target: true } } },
    })
  ) {
    return;
  }

  if (
    configFileExists(true) &&
    argv.config &&
    !isTargetedCommand(argv._, {
      config: { target: false, subCommands: { migrate: { target: true } } },
    })
  ) {
    logger.error(
      i18n(`commands.generalErrors.loadConfigMiddleware.configFileExists`, {
        configPath: getConfigPath()!,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  } else if (
    !isTargetedCommand(argv._, {
      init: { target: true },
      'get-started': { target: true },
    })
  ) {
    const config = loadConfig(argv.config as string, argv);

    // We don't run validateConfig() for auth or get-started because users should be able to run them when
    // no accounts are configured, but we still want to exit if the config file is not found for auth
    if (
      isTargetedCommand(argv._, { auth: { target: true } }) &&
      !config &&
      !isTargetedCommand(argv._, { 'get-started': { target: true } })
    ) {
      process.exit(EXIT_CODES.ERROR);
    }
  }

  maybeValidateConfig();
}

const accountsSubCommands = {
  target: false,
  subCommands: {
    auth: { target: true },
    clean: { target: true },
    list: { target: true },
    ls: { target: true },
    remove: { target: true },
  },
};

const sandboxesSubCommands = {
  target: false,
  subCommands: {
    delete: { target: true },
  },
};

const SKIP_ACCOUNT_VALIDATION = {
  init: { target: true },
  auth: { target: true },
  account: accountsSubCommands,
  accounts: accountsSubCommands,
  sandbox: sandboxesSubCommands,
  sandboxes: sandboxesSubCommands,
  'get-started': { target: true },
};

export async function validateAccountOptions(argv: Arguments): Promise<void> {
  // Skip this when no command is provided
  if (argv._.length && !argv.help) {
    let validAccount = true;
    if (!isTargetedCommand(argv._, SKIP_ACCOUNT_VALIDATION)) {
      validAccount = await validateAccount(argv);
    }

    if (!validAccount) {
      process.exit(EXIT_CODES.ERROR);
    }
  }
}
