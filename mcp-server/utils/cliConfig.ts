import {
  configFileExists,
  findConfig,
  getAccountId,
  loadConfig,
} from '@hubspot/local-dev-lib/config';

export function getAccountIdFromCliConfig(
  absolutePathToWorkingDirectory: string,
  accountNameOrId?: string | number
): number | null {
  const globalConfigExists = configFileExists(true);

  if (globalConfigExists) {
    loadConfig('');
  } else {
    const configPath = findConfig(absolutePathToWorkingDirectory);
    loadConfig(configPath!);
  }

  return getAccountId(accountNameOrId);
}
