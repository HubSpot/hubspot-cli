import fs from 'fs';
import path from 'path';
import process from 'process';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { logger } from '@hubspot/local-dev-lib/logger';

/**
 * Get's the file path to a module folder.
 * @param {string} moduleEntry
 * @param {string} fromFile
 */
const getModulePath = (moduleEntry, targetDir) => {
  try {
    const packageName = moduleEntry.includes('/')
      ? moduleEntry.startsWith('@')
        ? moduleEntry
            .split('/')
            .slice(0, 2)
            .join('/')
        : moduleEntry.split('/')[0]
      : moduleEntry;

    // Look in the target dir for the installed module
    const modulePath = path.join(targetDir, 'node_modules', packageName);

    if (fs.existsSync(modulePath)) return modulePath;

    // Look up the tree for the installed module
    const require = createRequire(import.meta.url);
    const lookupPaths = require.resolve
      .paths(moduleEntry)
      .map(p => path.join(p, packageName));

    return lookupPaths.find(p => fs.existsSync(p));
  } catch (e) {
    return null;
  }
};

function startChild(targetDir, command, args) {
  const child = spawn(command, [args], {
    cwd: targetDir,
    env: process.env,
    detached: true,
  });
  child.on('error', function(e) {
    logger.error(e);
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  return child;
}

function findAndRunInstalledModule(packageName, targetDir) {
  const modulePath = getModulePath(packageName, targetDir);

  if (modulePath) {
    const serverPath = path.join(modulePath, 'dist', 'run.js');
    return startChild(targetDir, serverPath, targetDir);
  }
  return null;
}

export function runModule(packageName, targetDir) {
  logger.log(`Attempting to run ${packageName} in ${targetDir}`);
  const child = findAndRunInstalledModule(packageName, targetDir);
  if (!child) {
    logger.error(`Package ${packageName} was not found`);
  }
  return child;
}
