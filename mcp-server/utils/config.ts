import { getLocalConfigFilePathIfExists } from '@hubspot/local-dev-lib/config';

export function setupHubSpotConfig(
  absoluteCurrentWorkingDirectory: string
): void {
  if (!absoluteCurrentWorkingDirectory) {
    return;
  }

  const configPath = getLocalConfigFilePathIfExists(
    absoluteCurrentWorkingDirectory
  );

  if (configPath) {
    process.env.HUBSPOT_CONFIG_PATH = configPath;
  }
}
