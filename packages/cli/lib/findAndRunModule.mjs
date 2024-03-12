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
export const getModulePath = (moduleEntry, component) => {
  try {
    const packageName = moduleEntry.includes('/')
      ? moduleEntry.startsWith('@')
        ? moduleEntry
            .split('/')
            .slice(0, 2)
            .join('/')
        : moduleEntry.split('/')[0]
      : moduleEntry;

    // const require = createRequire(import.meta.url);
    const modulePath = path.join(component.path, 'node_modules', moduleEntry);
    const moduleExists = fs.existsSync(modulePath);
    // const lookupPaths = require.resolve
    //   .paths(moduleEntry)
    //   .map(p => path.join(p, packageName));
    // console.log(lookupPaths);
    // return lookupPaths.find(p => fs.existsSync(p));
    return moduleExists ? modulePath : null;
  } catch (e) {
    return null;
  }
};

export function startChild(modulePath, component) {
  const serverPath = path.join(modulePath, 'dist', 'run.js');

  //logger.log('STARTING', serverPath);
  const child = spawn(serverPath, [component.path], {
    cwd: component.path,
    env: process.env,
    detached: true,
  });
  child.on('error', function(e) {
    logger.log(e);
  });
  child.stdout.pipe(process.stdout);
  // logger.log('STARTED with PID:', child.pid);

  return child;
}
