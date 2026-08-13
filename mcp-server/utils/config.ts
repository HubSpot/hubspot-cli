import { getLocalConfigFilePathIfExists } from '@hubspot/local-dev-lib/config';

export function setupHubSpotConfig(
  absoluteCurrentWorkingDirectory: string
): void {
  if (!absoluteCurrentWorkingDirectory) {
    return;
  }

  process.env.INIT_CWD = absoluteCurrentWorkingDirectory;

  const configPath = getLocalConfigFilePathIfExists(
    absoluteCurrentWorkingDirectory
  );

  if (configPath) {
    process.env.HUBSPOT_CONFIG_PATH = configPath;
  } else {
    // Clear any value set by a previous tool call so this call doesn't
    // inherit a stale config path from a different project.
    delete process.env.HUBSPOT_CONFIG_PATH;
  }
}
