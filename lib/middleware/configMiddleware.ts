import { Arguments } from 'yargs';
import { CLIOptions } from '@hubspot/local-dev-lib/types/CLIOptions';
import {
  loadConfig,
  getAccountId,
  configFileExists,
  getConfigPath,
  validateConfig,
} from '@hubspot/local-dev-lib/config';
import { validateAccount } from '../validation.js';
import { EXIT_CODES } from '../enums/exitCodes.js';
import { commands } from '../../lang/en.js';
import { uiDeprecatedTag } from '../ui/index.js';
import {
  isTargetedCommand,
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

/**
 * Auto-injects the derivedAccountId flag into all commands
 */
export async function injectAccountIdMiddleware(
  argv: Arguments<{ account?: string }>
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
    argv.derivedAccountId = getAccountId(account);
  }
}

export async function loadAndValidateConfigMiddleware(
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

  // If the config file exists and the --config flag is used, exit with an error
  if (
    configFileExists(true) &&
    argv.config &&
    !isTargetedCommand(argv._, { config: { migrate: true } })
  ) {
    uiLogger.error(
      commands.generalErrors.loadConfigMiddleware.configFileExists(
        getConfigPath()!
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const config = loadConfig(argv.config as string, argv);

  // We don't run validation for auth because users should be able to run it when
  // no accounts are configured, but we still want to exit if the config file is not found
  if (isTargetedCommand(argv._, { auth: true }) && !config) {
    process.exit(EXIT_CODES.ERROR);
  }

  // Only validate the config if the command requires it
  if (shouldRunConfigValidationForCommand(argv._)) {
    const configIsValid = validateConfig();
    if (!configIsValid) {
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
