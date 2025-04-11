import { Arguments, config } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { CLIOptions } from '@hubspot/local-dev-lib/types/CLIOptions';
import { validateAccount } from '../validation';
import { EXIT_CODES } from '../enums/exitCodes';
import { i18n } from '../lang';
import { uiDeprecatedTag, uiCommandReference } from '../ui';
import { isTargetedCommand } from './utils';
import { ENVIRONMENT_VARIABLES } from '@hubspot/local-dev-lib/constants/config';
import {
  getConfigAccountIfExists,
  getConfigFilePath,
  getConfigDefaultAccountIfExists,
  isConfigValid,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';

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
          configPath: getConfigFilePath()!,
        }
      )
    );
    process.env.HUBSPOT_ACCOUNT_ID = process.env.HUBSPOT_PORTAL_ID;
  }
}

export function addConfigEnvironmentVariablesMiddleware(
  argv: Arguments<{ useEnv?: boolean; config?: string }>
) {
  const { useEnv, config } = argv;

  if (useEnv) {
    process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG] = 'true';
  }

  if (config) {
    process.env[ENVIRONMENT_VARIABLES.HUBSPOT_CONFIG_PATH] = config;
  }
}

/**
 * Auto-injects the derivedAccountId flag into all commands
 */
export async function injectAccountIdMiddleware(
  argv: Arguments<{ account?: string }>
): Promise<void> {
  const { account: accountOption } = argv;

  // Preserves the original --account flag for certain commands.
  argv.providedAccountId = accountOption;

  const hubspotAccountId =
    process.env[ENVIRONMENT_VARIABLES.HUBSPOT_ACCOUNT_ID];

  // Check environment variables for accountId
  if (argv.useEnv && hubspotAccountId) {
    argv.derivedAccountId = parseInt(hubspotAccountId, 10);
    return;
  }

  // If not using environment variables, check if provided account exists
  if (accountOption) {
    const account = getConfigAccountIfExists(accountOption);
    if (account) {
      argv.derivedAccountId = account.accountId;
    } else {
      logger.error(
        i18n(
          'commands.generalErrors.injectAccountIdMiddleware.accountNotFound',
          {
            accountIdentifier: accountOption,
            authCommand: uiCommandReference('{authCommand}'),
          }
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  // If no provided account or environment variable, use the default account
  if (!argv.derivedAccountId) {
    const defaultAccount = getConfigDefaultAccountIfExists();
    argv.derivedAccountId = defaultAccount?.accountId;
  }
}

const SKIP_CONFIG_VALIDATION = {
  init: { target: true },
  auth: { target: true },
};

export async function validateConfigMiddleware(argv: Arguments<CLIOptions>) {
  // Skip this when no command is provided
  if (!argv._.length) {
    return;
  }

  const maybeValidateConfig = () => {
    if (
      !isTargetedCommand(argv._, SKIP_CONFIG_VALIDATION) &&
      !isConfigValid()
    ) {
      process.exit(EXIT_CODES.ERROR);
    }
  };

  if (globalConfigFileExists() && argv.config) {
    logger.error(
      i18n(`commands.generalErrors.loadConfigMiddleware.configFileExists`, {
        configPath: getConfigFilePath(),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  } else if (!isTargetedCommand(argv._, { init: { target: true } })) {
    // We don't run isConfigValid() for auth because users should be able to run it when
    // no accounts are configured, but we still want to exit if the config file is not found
    if (isTargetedCommand(argv._, { auth: { target: true } }) && !config) {
      process.exit(EXIT_CODES.ERROR);
    }
  }

  maybeValidateConfig();
}

const accountsSubCommands = {
  target: false,
  subCommands: {
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
};

export async function validateAccountOptions(argv: Arguments): Promise<void> {
  // Skip this when no command is provided
  if (argv._.length) {
    let validAccount = true;
    if (!isTargetedCommand(argv._, SKIP_ACCOUNT_VALIDATION)) {
      validAccount = await validateAccount(argv);
    }

    if (!validAccount) {
      process.exit(EXIT_CODES.ERROR);
    }
  }
}
