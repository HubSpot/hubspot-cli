import { existsSync, mkdirSync, rmSync } from 'fs';
import { testOutputDir } from './lib/testState';

if (!globalThis.hasRanBefore) {
  if (!existsSync(testOutputDir)) {
    console.log(`${testOutputDir} does not exist, creating.`);
    mkdirSync(testOutputDir);
  } else {
    console.log(`${testOutputDir} already exists, deleting`);
    rmSync(testOutputDir, { recursive: true, force: true });
  }
  globalThis.hasRanBefore = true;
}
