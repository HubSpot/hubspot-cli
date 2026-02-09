import updateNotifier from 'update-notifier';
import { pkg } from './jsonLoader.js';
import {
  isGloballyInstalled,
  executeInstall,
  getLatestPackageVersion,
  isInstalledGloballyWithNPM,
} from './npm/npmCli.js';

export type CLIUpgradeInfo = {
  current?: string;
  latest?: string;
  type?: string;
};

// HACK: Initialize the cliUpgradeInfo with the initial notifier data before the first call to getCliUpgradeInfo()
// This is a workaround to enable getCliUpgradeInfo() to work on the first call rather than requiring a second command execution.
const cliUpgradeInfo: CLIUpgradeInfo = getCliUpgradeInfoFromNotifier();

/*
 * Check if the CLI is globally installed
 */
export const isCliGloballyInstalled = async (): Promise<boolean> => {
  return isGloballyInstalled('hs');
};

/**
 * Check if the CLI is globally installed via npm
 */
export async function canCliBeAutoUpgraded(): Promise<boolean> {
  return isInstalledGloballyWithNPM(pkg.name);
}

export async function getLatestCliVersion(): Promise<{
  latest: string | null;
  next: string | null;
}> {
  return getLatestPackageVersion(pkg.name);
}

/**
 * Get the CLI upgrade information from the notifier
 */
function getCliUpgradeInfoFromNotifier(): CLIUpgradeInfo {
  const notifier = updateNotifier({
    pkg,
    distTag: 'latest',
    shouldNotifyInNpmScript: true,
  });

  const result: CLIUpgradeInfo = {};

  if (notifier && notifier.update) {
    result.current = notifier.update.current;
    result.latest = notifier.update.latest;
    result.type = notifier.update.type;
  }

  return result;
}

/**
 * Get update information using update-notifier
 */
export function getCliUpgradeInfo(): CLIUpgradeInfo {
  // Avoid excessive calls to the notifier by returning the cached data if it exists
  if (cliUpgradeInfo.current && cliUpgradeInfo.latest && cliUpgradeInfo.type) {
    return cliUpgradeInfo;
  }

  const newUpgradeInfo = getCliUpgradeInfoFromNotifier();

  if (
    newUpgradeInfo?.current &&
    newUpgradeInfo?.latest &&
    newUpgradeInfo?.type
  ) {
    cliUpgradeInfo.current = newUpgradeInfo.current;
    cliUpgradeInfo.latest = newUpgradeInfo.latest;
    cliUpgradeInfo.type = newUpgradeInfo.type;
  }

  return cliUpgradeInfo;
}

/**
 * Install a specific version of the CLI globally
 */
export async function installCliVersion(
  version: string = 'latest'
): Promise<void> {
  await executeInstall([`${pkg.name}@${version}`], '-g');
}
