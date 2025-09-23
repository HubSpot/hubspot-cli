import { spawn } from 'node:child_process';
import { rm, cp } from 'node:fs/promises';
import { logger, setLogLevel, LOG_LEVEL } from '@hubspot/local-dev-lib/logger';
import { EXIT_CODES } from '../../lib/enums/exitCodes.ts';

export async function build(): Promise<void> {
  try {
    setLogLevel(LOG_LEVEL.LOG);
    logger.log('Creating a new build...');
    logger.log();
    await rm('dist', { recursive: true, force: true });

    // Build typescript
    await new Promise<void>((resolve, reject) => {
      const childProcess = spawn('yarn', ['tsc'], {
        stdio: 'inherit',
      });

      childProcess.on('error', error => {
        reject(error);
      });
      childProcess.on('close', code => {
        if (code !== EXIT_CODES.SUCCESS) {
          reject(new Error(`Build failed with exit code ${code}`));
        } else {
          resolve();
        }
      });
    });
    // Copy remaining files
    await Promise.all([
      cp('lang/en.lyaml', 'dist/lang/en.lyaml'),
      cp('bin/hs', 'dist/bin/hs'),
      cp('bin/hscms', 'dist/bin/hscms'),
      cp('README.md', 'dist/README.md'),
      cp('LICENSE', 'dist/LICENSE'),
    ]);
    logger.success('Build successful');
  } catch (error) {
    logger.error('Build failed:', error);
    process.exit(1);
  }
}
