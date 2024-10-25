import { existsSync, mkdirSync, rmSync } from 'fs';
import { testOutputDir } from './lib/TestState';
import { getTestConfig } from './lib/env';

// Vitest docs on globalSetup modules https://vitest.dev/config/#globalsetup
export function setup() {
  try {
    if (getTestConfig().useInstalled) {
      console.log('Using installed version of the hs command');
    }

    if (existsSync(testOutputDir)) {
      console.log(
        `The directory ${testOutputDir} already exists, deleting it's contents\n`
      );
      rmSync(testOutputDir, { recursive: true, force: true });
    }

    console.log(`Setting up ${testOutputDir} directory\n`);
    mkdirSync(testOutputDir);
  } catch (e) {
    console.log(e);
  }
}

export function teardown() {
  try {
    if (existsSync(testOutputDir)) {
      console.log(`Cleaning up ${testOutputDir} directory\n`);
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.log(e);
  }
}
