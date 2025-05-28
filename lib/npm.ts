import { exec as execAsync } from 'child_process';
import util from 'util';
import { logger } from '@hubspot/local-dev-lib/logger';
import pkg from '../package.json';

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

export async function getLatestCliVersion(): Promise<{
  latest: string;
  next: string;
}> {
  const exec = util.promisify(execAsync);
  const { stdout } = await exec(`npm info ${pkg.name} dist-tags --json`);
  const { latest, next } = JSON.parse(stdout);
  return { latest, next };
}

export async function executeInstall(
  packages: string[] = [],
  flags?: string | null,
  options?: { cwd?: string }
): Promise<void> {
  const installCommand = `${DEFAULT_PACKAGE_MANAGER} install${flags ? ` ${flags}` : ''} ${packages.join(' ')}`;
  logger.debug('Running ', installCommand);

  const exec = util.promisify(execAsync);
  await exec(installCommand, options);
}
