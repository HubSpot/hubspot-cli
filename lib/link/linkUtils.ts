import { localConfigFileExists } from '@hubspot/local-dev-lib/config';
import {
  getHsSettingsFileIfExists,
  writeHsSettingsFile,
} from '@hubspot/local-dev-lib/config/hsSettings';
import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { uiLogger } from '../ui/logger.js';
import { debugError } from '../errorHandlers/index.js';
import { commands } from '../../lang/en.js';

export function isDirectoryLinked(
  settings: HsSettingsFile | null
): settings is HsSettingsFile {
  return settings !== null && settings.accounts.length > 0;
}

export function hasDeprecatedConfigConflict(
  commandArgs: (string | number)[]
): boolean {
  if (localConfigFileExists()) {
    uiLogger.error(
      commands.account.subcommands.link.shared.deprecatedConfigNotSupported(
        `hs ${commandArgs.join(' ')}`
      )
    );
    return true;
  }
  return false;
}

export function addAccountToLinkedSettings(accountId: number): void {
  if (localConfigFileExists()) {
    return;
  }

  const settings = getHsSettingsFileIfExists();

  if (!settings || settings.accounts.length === 0) {
    return;
  }

  if (settings.accounts.includes(accountId)) {
    return;
  }

  const updated: HsSettingsFile = {
    ...settings,
    accounts: [...settings.accounts, accountId],
  };

  try {
    writeHsSettingsFile(updated);
    uiLogger.info(
      commands.account.subcommands.link.shared.accountAutoLinked(accountId)
    );
  } catch (err) {
    uiLogger.warn(
      commands.account.subcommands.link.shared.accountAutoLinkFailed(accountId)
    );
    debugError(err);
  }
}

export function writeLinkedSettings(
  settings: HsSettingsFile,
  settingsPath: string
): boolean {
  try {
    writeHsSettingsFile(settings);
    return true;
  } catch (err) {
    uiLogger.error(
      commands.account.subcommands.link.shared.writeSettingsFailed(
        settingsPath,
        err
      )
    );
    return false;
  }
}
