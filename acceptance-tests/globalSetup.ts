import { existsSync, mkdirSync, rmSync } from 'fs';
import { testOutputDir } from './lib/testState';
import type { GlobalSetupContext } from 'vitest/node'
import * as dotEnv from "dotenv";
import * as path from "path";


// Vitest docs on globalSetup modules https://vitest.dev/config/#globalsetup
export function setup(__context: GlobalSetupContext) {
    try {
        const dotEnvConfig = dotEnv.config({ path: path.join(__dirname, './.env') });
        const { parsed }  = dotEnvConfig

        if(parsed && parsed.USE_INSTALLED) {
            console.log('Using installed version of the hs command')
        }

        if(existsSync(testOutputDir)) {
            console.log(`The directory ${testOutputDir} already exists, deleting it's contents\n`);
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
