import { existsSync, mkdirSync, rmSync } from 'fs';
import { testOutputDir } from './lib/testState';
import type { GlobalSetupContext } from 'vitest/node'

// Vitest docs on globalSetup modules https://vitest.dev/config/#globalsetup
export function setup(__context: GlobalSetupContext) {
    try {
        if(existsSync(testOutputDir)) {
            console.log(`${testOutputDir} already exists, deleting it's contents\n`);
            rmSync(testOutputDir, { recursive: true, force: true });
        }
        console.log(`Setting up ${testOutputDir} directory\n`);
        mkdirSync(testOutputDir);
    } catch (e) {
        console.log(e)
    }
}

export function teardown() {
    try {
        if (existsSync(testOutputDir)) {
            console.log(`Cleaning up ${testOutputDir} directory\n`);
            rmSync(testOutputDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.log(e)
    }
}
