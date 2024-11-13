import { spawn } from 'child_process';
import fs from 'fs';
import { logger, setLogLevel, LOG_LEVEL } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

export async function build(): Promise<void> {
  setLogLevel(LOG_LEVEL.LOG);
  logger.log('Creating a new build...');
  logger.log();

  // Remove the current dist dir
  fs.rmSync('dist', { recursive: true, force: true });

  // Build typescript
  await new Promise(resolve => {
    const childProcess = spawn('yarn', ['tsc'], {
      stdio: 'inherit',
    });

    childProcess.on('close', code => {
      if (code !== EXIT_CODES.SUCCESS) {
        process.exit(code);
      }
      resolve('');
    });
  });

  // Copy remaining files
  fs.cpSync('lang', 'dist/lang', { recursive: true });
  fs.cpSync('bin/hs', 'dist/bin/hs');
  fs.cpSync('bin/hscms', 'dist/bin/hscms');
  fs.cpSync('README.md', 'dist/README.md');
  fs.cpSync('LICENSE', 'dist/LICENSE');

  logger.success('Build successful');
}
