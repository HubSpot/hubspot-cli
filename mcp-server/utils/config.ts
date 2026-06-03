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
  }
}
