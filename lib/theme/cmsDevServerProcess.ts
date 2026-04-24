import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { getConfigFilePath } from '@hubspot/local-dev-lib/config';
import SpinniesManager from '../ui/SpinniesManager.js';
import { lib } from '../../lang/en.js';
import { ExitCode, ExitFunction } from '../../types/Yargs.js';
import { EXIT_CODES } from '../enums/exitCodes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cms-dev-server version to install to isolated cache
const TARGET_CMS_DEV_SERVER_VERSION = '1.2.26';

interface DevServerOptions {
  absoluteSrc: string;
  accountName?: string;
  noSsl?: boolean;
  port?: number;
  generateFieldsTypes?: boolean;
  resetSession?: boolean;
  dest: string;
  exit: ExitFunction;
}

/**
 * Ensures cms-dev-server is installed in an isolated cache directory.
 * This prevents React version conflicts with the CLI.
 */
async function ensureCmsDevServerCache(targetVersion: string): Promise<string> {
  const cacheDir = path.join(os.homedir(), '.hscli', '.module-cache');
  const packageJsonPath = path.join(
    cacheDir,
    'node_modules',
    '@hubspot',
    'cms-dev-server',
    'package.json'
  );

  // Check if already installed with correct version
  let needsInstall = true;
  if (fs.existsSync(packageJsonPath)) {
    try {
      const installedPackage = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8')
      );
      if (installedPackage.version === targetVersion) {
        needsInstall = false;
      }
    } catch (e) {
      // If we can't read the package.json, reinstall
      needsInstall = true;
    }
  }

  if (needsInstall) {
    // Show spinner during install (can take 10-30 seconds)
    SpinniesManager.init({
      succeedColor: 'white',
    });
    SpinniesManager.add('cms-dev-server-install', {
      text: lib.theme.cmsDevServerProcess.installStarted(targetVersion),
    });

    // Create cache directory
    fs.mkdirSync(cacheDir, { recursive: true });

    // Clear old installation if exists
    const nodeModulesDir = path.join(cacheDir, 'node_modules');
    if (fs.existsSync(nodeModulesDir)) {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
    }

    // Install cms-dev-server with production dependencies only (async to allow spinner)
    await new Promise<void>((resolve, reject) => {
      const installProcess = spawn(
        'npm',
        [
          'install',
          `@hubspot/cms-dev-server@${targetVersion}`,
          '--production',
          '--no-save',
          '--loglevel=error',
        ],
        {
          cwd: cacheDir,
          stdio: 'ignore', // Suppress npm output
        }
      );

      installProcess.on('close', code => {
        if (code === 0) {
          SpinniesManager.succeed('cms-dev-server-install', {
            text: lib.theme.cmsDevServerProcess.installSucceeded,
          });
          resolve();
        } else {
          SpinniesManager.fail('cms-dev-server-install', {
            text: lib.theme.cmsDevServerProcess.installFailed,
          });
          reject(new Error(lib.theme.cmsDevServerProcess.installFailed));
        }
      });

      installProcess.on('error', error => {
        SpinniesManager.fail('cms-dev-server-install', {
          text: lib.theme.cmsDevServerProcess.installFailed,
        });
        reject(error);
      });
    });
  }

  return cacheDir;
}

export async function spawnDevServer(
  options: DevServerOptions
): Promise<ChildProcess> {
  const {
    absoluteSrc,
    accountName,
    noSsl,
    port,
    generateFieldsTypes,
    resetSession,
    dest,
    exit,
  } = options;
  // Ensure cms-dev-server is installed in isolated cache
  const cacheDir = await ensureCmsDevServerCache(TARGET_CMS_DEV_SERVER_VERSION);

  // Get config path to pass to createDevServer
  let configPath = '';
  try {
    configPath = process.env.HUBSPOT_CONFIG_PATH || getConfigFilePath();
  } catch (e) {
    // Config file doesn't exist - cms-dev-server will handle this gracefully
  }

  // Copy the runner script to the cache directory so imports resolve from there
  // This is critical: Node resolves ES module imports relative to the script location,
  // not the cwd. By copying the script to the cache directory, imports will resolve
  // from the cache's node_modules (React 18) instead of the CLI's node_modules (React 19)
  const sourceRunnerPath = path.join(__dirname, 'cmsDevServerRunner.js');
  const targetRunnerPath = path.join(cacheDir, 'cmsPreviewRunner.js');
  fs.copyFileSync(sourceRunnerPath, targetRunnerPath);

  // Set environment variables to pass configuration to the runner script
  const env = { ...process.env };
  env.CMS_DEV_SERVER_SRC = absoluteSrc;
  env.CMS_DEV_SERVER_DEST = dest;
  env.CMS_DEV_SERVER_CONFIG = configPath;
  env.CMS_DEV_SERVER_ACCOUNT = accountName || '';
  env.CMS_DEV_SERVER_SSL = (!noSsl).toString();
  env.CMS_DEV_SERVER_FIELD_GEN = Boolean(generateFieldsTypes).toString();
  env.CMS_DEV_SERVER_RESET_SESSION = Boolean(resetSession).toString();
  if (port) {
    env.PORT = port.toString();
  }
  // Suppress Node.js deprecation warnings
  env.NODE_NO_WARNINGS = '1';

  // Spawn Node with the runner script from the isolated cache directory
  // This ensures complete isolation from CLI's React 19
  const devServer = spawn('node', [targetRunnerPath], {
    stdio: 'inherit',
    env,
    cwd: cacheDir,
  });

  // Handle process events
  devServer.on('error', async error => {
    console.error(lib.theme.cmsDevServerProcess.serverStartError(error));
    await exit(EXIT_CODES.ERROR);
  });

  devServer.on('exit', async (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(lib.theme.cmsDevServerProcess.serverExit(code));
      await exit(code as ExitCode);
    }
    if (signal) {
      console.error(lib.theme.cmsDevServerProcess.serverKill(signal));
      await exit(EXIT_CODES.ERROR);
    }
  });

  // Handle CLI termination
  process.once('SIGINT', () => {
    devServer.kill('SIGINT');
  });

  process.once('SIGTERM', () => {
    devServer.kill('SIGTERM');
  });

  return devServer;
}
