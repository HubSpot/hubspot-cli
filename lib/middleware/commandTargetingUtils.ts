import { configFileExists } from '@hubspot/local-dev-lib/config';

type TargetCommandMap = {
  [key: string]: boolean | TargetCommandMap;
};

export function isTargetedCommand(
  commandParts: (string | number)[],
  targetCommandMap: TargetCommandMap
): boolean {
  const currentCommandPart = commandParts[0];

  if (!targetCommandMap[currentCommandPart]) {
    return false;
  }

  if (
    typeof targetCommandMap[currentCommandPart] === 'boolean' &&
    targetCommandMap[currentCommandPart]
  ) {
    return true;
  }

  if (commandParts.length > 1) {
    const targetSubCommandMap = targetCommandMap[currentCommandPart];

    if (!targetSubCommandMap) {
      return false;
    }

    return isTargetedCommand(commandParts.slice(1), targetSubCommandMap);
  }

  return false;
}

const SKIP_CONFIG_LOADING_COMMANDS = {
  init: true,
  feedback: true,
};

// Returns true if the command requires a config file to be present
export function shouldLoadConfigForCommand(commandParts: (string | number)[]) {
  const globalConfigExists = configFileExists(true);

  // the user is trying to migrate the global config
  const isGlobalConfigMigration =
    !globalConfigExists &&
    isTargetedCommand(commandParts, {
      account: { auth: true },
      config: { migrate: true },
    });

  return (
    !isGlobalConfigMigration &&
    !isTargetedCommand(commandParts, SKIP_CONFIG_LOADING_COMMANDS)
  );
}

const SKIP_CONFIG_VALIDATION_COMMANDS = {
  auth: true,
  account: { auth: true },
  mcp: {
    setup: true,
    start: true,
  },
};

// Returns true if the command requires a valid config file to be present
// Should only run if config has been loaded
export function shouldRunConfigValidationForCommand(
  commandParts: (string | number)[]
) {
  return (
    shouldLoadConfigForCommand(commandParts) &&
    !isTargetedCommand(commandParts, SKIP_CONFIG_VALIDATION_COMMANDS)
  );
}

const accountsSubCommands = {
  auth: true,
  clean: true,
  list: true,
  ls: true,
  remove: true,
  use: true,
};

const sandboxesSubCommands = {
  delete: true,
};

const SKIP_ACCOUNT_VALIDATION_COMMANDS = {
  account: accountsSubCommands,
  accounts: accountsSubCommands,
  sandbox: sandboxesSubCommands,
  sandboxes: sandboxesSubCommands,
  config: {
    migrate: true,
  },
};

// Returns true if the command requires a valid account to be set in the config
// Should only run if config has been loaded and validated
export function shouldRunAccountValidationForCommand(
  commandParts: (string | number)[]
) {
  return (
    shouldRunConfigValidationForCommand(commandParts) &&
    !isTargetedCommand(commandParts, SKIP_ACCOUNT_VALIDATION_COMMANDS)
  );
}
