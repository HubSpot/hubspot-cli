import { spawn } from 'child_process';
import fs from 'fs';
import { EXIT_CODES } from '../../lib/enums/exitCodes';

export async function build(): Promise<void> {
  // Remove the current dist dir
  console.log('BUILD');
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
}
