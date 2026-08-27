import { spawn } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';
import SpinniesManager from '../ui/SpinniesManager.js';
import { lib } from '../../lang/en.js';

const TARGET_SERVERLESS_RUNTIME_VERSION = '7.0.7';

const CACHE_DIR = path.join(
  os.homedir(),
  '.hscli',
  '.serverless-runtime-cache'
);

async function ensureServerlessRuntimeInstalled(): Promise<void> {
  const packageJsonPath = path.join(
    CACHE_DIR,
    'node_modules',
    '@hubspot',
    'serverless-dev-runtime',
    'package.json'
  );

  let needsInstall = true;
  if (fs.existsSync(packageJsonPath)) {
    try {
      const installed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (installed.version === TARGET_SERVERLESS_RUNTIME_VERSION) {
        needsInstall = false;
      }
    } catch {
      needsInstall = true;
    }
  }

  if (!needsInstall) {
    return;
  }

  SpinniesManager.init({ succeedColor: 'white' });
  SpinniesManager.add('serverless-runtime-install', {
    text: lib.cms.serverlessDevRuntime.installStarted(
      TARGET_SERVERLESS_RUNTIME_VERSION
    ),
  });

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const nodeModulesDir = path.join(CACHE_DIR, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    fs.rmSync(nodeModulesDir, { recursive: true, force: true });
  }

  await new Promise<void>((resolve, reject) => {
    const installProcess = spawn(
      'npm',
      [
        'install',
        `@hubspot/serverless-dev-runtime@${TARGET_SERVERLESS_RUNTIME_VERSION}`,
        '--production',
        '--no-save',
        '--loglevel=error',
      ],
      { cwd: CACHE_DIR, stdio: 'ignore' }
    );

    installProcess.on('close', code => {
      if (code === 0) {
        SpinniesManager.succeed('serverless-runtime-install', {
          text: lib.cms.serverlessDevRuntime.installSucceeded,
        });
        resolve();
      } else {
        SpinniesManager.fail('serverless-runtime-install', {
          text: lib.cms.serverlessDevRuntime.installFailed,
        });
        reject(new Error(lib.cms.serverlessDevRuntime.installFailed));
      }
    });

    installProcess.on('error', error => {
      SpinniesManager.fail('serverless-runtime-install', {
        text: lib.cms.serverlessDevRuntime.installFailed,
      });
      reject(error);
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startServerlessDevRuntime(options: any): Promise<void> {
  await ensureServerlessRuntimeInstalled();

  const requireFromCache = createRequire(path.join(CACHE_DIR, 'package.json'));
  const { start } = requireFromCache(
    '@hubspot/serverless-dev-runtime'
  ) as typeof import('@hubspot/serverless-dev-runtime');

  start(options);
}
