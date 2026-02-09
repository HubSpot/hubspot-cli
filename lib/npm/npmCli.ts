import { exec as execAsync } from 'node:child_process';
import util from 'util';
import { uiLogger } from '../ui/logger.js';

export const DEFAULT_PACKAGE_MANAGER = 'npm';

export async function isGloballyInstalled(
  packageName: string
): Promise<boolean> {
  const exec = util.promisify(execAsync);
  try {
    await exec(`${packageName} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

export async function getLatestPackageVersion(packageName: string): Promise<{
  latest: string | null;
  next: string | null;
}> {
  try {
    const exec = util.promisify(execAsync);
    const { stdout } = await exec(`npm info ${packageName} dist-tags --json`);
    const { latest, next } = JSON.parse(stdout);
    return { latest, next };
  } catch (e) {
    return { latest: null, next: null };
  }
}

export async function executeInstall(
  packages: string[] = [],
  flags?: string | null,
  options?: { cwd?: string }
): Promise<void> {
  const installCommand = `${DEFAULT_PACKAGE_MANAGER} install${flags ? ` ${flags}` : ''} ${packages.join(' ')}`;
  uiLogger.debug('Running', installCommand);

  const exec = util.promisify(execAsync);
  await exec(installCommand, options);
}

export async function executeUpdate(
  packages: string[] = [],
  flags?: string | null,
  options?: { cwd?: string }
): Promise<void> {
  const updateCommand = `${DEFAULT_PACKAGE_MANAGER} update${flags ? ` ${flags}` : ''} ${packages.join(' ')}`;
  uiLogger.debug('Running', updateCommand);

  const exec = util.promisify(execAsync);
  await exec(updateCommand, options);
}

/**
 * Check if a package is installed globally via npm
 * This verifies that npm can see the package in its global packages list
 */
export async function isInstalledGloballyWithNPM(
  packageName: string
): Promise<boolean> {
  // First check if npm is available
  const isNpmGloballyInstalled = await isGloballyInstalled(
    DEFAULT_PACKAGE_MANAGER
  );
  if (!isNpmGloballyInstalled) {
    return false;
  }

  // Then verify that npm can see the package in its global installation
  // This definitively proves it was installed via npm
  const exec = util.promisify(execAsync);
  try {
    await exec(`npm list -g ${packageName} --depth=0`);
    return true;
  } catch (e) {
    // npm list fails if the package isn't installed globally via npm
    return false;
  }
}
