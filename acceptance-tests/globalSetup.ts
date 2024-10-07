import { existsSync, mkdirSync, rmSync } from 'fs';
import { testOutputDir } from './lib/testState';
import type { GlobalSetupContext } from 'vitest/node'

// Vitest docs on globalSetup modules https://vitest.dev/config/#globalsetup
export function setup({ provide }: GlobalSetupContext) {
    try {
        if (!existsSync(testOutputDir)) {
            console.log(`Setting up ${testOutputDir} directory\n`);
            mkdirSync(testOutputDir);
        } else {
            console.log(`${testOutputDir} already exists, deleting it's contents\n`);
            rmSync(testOutputDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.log(e)
    }
}

export function teardown() {
    try {
        if (existsSync(testOutputDir)) {
            console.log(`cleaning up ${testOutputDir} directory\n`);
            rmSync(testOutputDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.log(e)
    }
}
