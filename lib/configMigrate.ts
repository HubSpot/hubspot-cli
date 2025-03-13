import { CLIConfig_DEPRECATED } from '@hubspot/local-dev-lib/types/Config';
import {
  writeConfig,
  createEmptyConfigFile,
  loadConfig,
  deleteEmptyConfigFile,
  deleteConfigFile,
} from '@hubspot/local-dev-lib/config';
import { logError } from './errorHandlers';
import { EXIT_CODES } from './enums/exitCodes';

export function migrateConfig(oldConfig: CLIConfig_DEPRECATED): void {
  const { defaultPortal, portals, ...rest } = oldConfig;
  const updatedConfig = {
    ...rest,
    defaultAccount: defaultPortal,
    accounts: portals
      .filter(({ portalId }) => portalId !== undefined)
      .map(({ portalId, ...rest }) => ({
        ...rest,
        accountId: portalId!,
      })),
  };
  const updatedConfigJson = JSON.stringify(updatedConfig);
  createEmptyConfigFile({}, true);
  loadConfig('');

  try {
    writeConfig({ source: updatedConfigJson });
    deleteConfigFile(true);
  } catch (error) {
    deleteEmptyConfigFile();

    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }
}
