import { exec } from 'child_process';
import fs from 'fs';

async function build(): Promise<void> {
  // Remove the current dist dir
  fs.rmSync('dist', { recursive: true, force: true });

  // Build typescript
  await exec('yarn tsc');

  // Copy remaining files
  fs.cpSync('lang', 'dist/lang', { recursive: true });
  fs.cpSync('bin/hs', 'dist/bin/hs');
  fs.cpSync('bin/hscms', 'dist/bin/hscms');
  fs.cpSync('README.md', 'dist/README.md');
  fs.cpSync('LICENSE', 'dist/LICENSE');
}

build();
