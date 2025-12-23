import path from 'path';
import { Arguments } from 'yargs';
import { CLIOptions } from '@hubspot/local-dev-lib/types/CLIOptions';
import {
  getConfigAccountIfExists,
  validateConfig,
  getConfigDefaultAccountIfExists,
  configFileExists,
} from '@hubspot/local-dev-lib/config';
import { ENVIRONMENT_VARIABLES } from '@hubspot/local-dev-lib/constants/config';
import { getCwd } from '@hubspot/local-dev-lib/path';
import { validateAccount } from '../validation.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { commands } from '../../lang/en.js';
import { uiDeprecatedTag } from '../ui/index.js';
import {
  shouldLoadConfigForCommand,
  shouldRunAccountValidationForCommand,
  shouldRunConfigValidationForCommand,
} from './commandTargetingUtils.js';
import { parseStringToNumber } from '../parsing.js';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';

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
      commands.generalErrors.handleDeprecatedEnvVariables.portalEnvVarDeprecated
    );
    process.env.HUBSPOT_ACCOUNT_ID = process.env.HUBSPOT_PORTAL_ID;
  }
}

export function handleCustomConfigLocationMiddleware(
  argv: Arguments<{ useEnv?: boolean; config?: string }>
): void {
  const { useEnv, config } = argv;
  if (useEnv) {
    process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG] = 'true';
  } else if (config && typeof config === 'string') {
    const absoluteConfigPath = path.isAbsolute(config)
      ? config
      : path.join(getCwd(), config);
    process.env.HUBSPOT_CONFIG_PATH = absoluteConfigPath;
  }
}

/**
 * Auto-injects the derivedAccountId flag into all commands
 */
export async function injectAccountIdMiddleware(
  argv: Arguments<{ account?: string; config?: string }>
): Promise<void> {
  const { account } = argv;

  // Preserves the original --account flag for certain commands.
  argv.userProvidedAccount = account;

  if (argv.useEnv && process.env.HUBSPOT_ACCOUNT_ID) {
    try {
      argv.derivedAccountId = parseStringToNumber(
        process.env.HUBSPOT_ACCOUNT_ID
      );
    } catch (err) {
      uiLogger.error(lib.configMiddleWare.invalidAccountIdEnvironmentVariable);
    }
  } else {
    // Wrap in try-catch to handle cases where config file doesn't exist yet (e.g., during hs init)
    try {
      let accountInConfig = account
        ? getConfigAccountIfExists(account)
        : undefined;

      if (!accountInConfig) {
        accountInConfig = getConfigDefaultAccountIfExists();
      }

      argv.derivedAccountId = accountInConfig?.accountId;
    } catch (err) {
      // Config file doesn't exist yet, which is fine for commands like hs init
      argv.derivedAccountId = undefined;
    }
  }
}

export async function validateConfigMiddleware(
  argv: Arguments<CLIOptions>
): Promise<void> {
  // Skip this when no command is provided
  if (!argv._.length || argv.help) {
    return;
  }

  // Do not load or validate the config for the commands that do not require it
  if (!shouldLoadConfigForCommand(argv._)) {
    return;
  }

  // We don't run validation for auth because users should be able to run it when
  // no accounts are configured, but we still want to exit if the config file is not found
  if (
    !process.env[ENVIRONMENT_VARIABLES.USE_ENVIRONMENT_HUBSPOT_CONFIG] &&
    !configFileExists()
  ) {
    console.error(
      'Config file not found, run hs account auth to configure your account'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  // Only validate the config if the command requires it
  if (shouldRunConfigValidationForCommand(argv._)) {
    const { isValid, errors } = validateConfig();
    if (!isValid) {
      uiLogger.error(
        commands.generalErrors.validateConfigMiddleware.configValidationFailed(
          errors
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }
}

export async function validateAccountOptions(argv: Arguments): Promise<void> {
  // Skip this when no command is provided
  if (argv._.length && !argv.help) {
    let validAccount = true;

    // Only validate the account if the command requires it
    if (shouldRunAccountValidationForCommand(argv._)) {
      validAccount = await validateAccount(argv);
    }

    if (!validAccount) {
      process.exit(EXIT_CODES.ERROR);
    }
  }
}
