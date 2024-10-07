/**
 * Integration test helper
 * Author: Andrés Zorro <zorrodg@gmail.com>
 * Taken from https://gist.github.com/zorrodg/c349cf54a3f6d0a9ba62e0f4066f31cb
 */
import { CLI, TestConfig } from './types';
import { existsSync, mkdirSync } from 'fs';
import { constants } from 'os';
import spawn from 'cross-spawn';
import concat from 'concat-stream';
import * as process from 'node:process';
import * as path from 'node:path';

const PATH = process.env.PATH;

export function createProcess(
  config: TestConfig,
  args: string[] = [],
  env = null
) {
  let processCommand: string;
  const { cliVersion, cliPath, debug } = config;

  if (cliVersion) {
    processCommand = 'npx';
    args = ['--yes', '--package', `@hubspot/cli@${cliVersion}`, 'hs'].concat(
      args
    );
  } else {
    // Ensure that path exists
    if (!cliPath || !existsSync(cliPath)) {
      throw new Error(`Invalid process path ${cliPath}`);
    }
    processCommand = 'node';
    args = [cliPath].concat(args);
  }

  if (debug) {
    args.push('--debug');
  }

  // This works for node based CLIs, but can easily be adjusted to
  // any other process installed in the system
  return spawn(processCommand, args, {
    env: {
      NODE_ENV: 'test',
      preventAutoStart: false,
      PATH, // This is needed in order to get all the binaries in your current terminal
      npm_config_loglevel: 'silent', // suppress warnings
      ...env,
      GITHUB_TOKEN: config.githubToken,
    },
    stdio: [null, null, null, 'ipc'], // This enables interprocess communication (IPC)
    cwd: path.join(process.cwd(), config.testDir),
  });
}

function executeWithInput(
  config: TestConfig,
  args: string[] = [],
  inputs: string[] = [],
  opts: any = {}
) {
  if (!Array.isArray(inputs)) {
    opts = inputs;
    inputs = [];
  }

  // Prevent the browser from opening when `open` is called
  opts.env = { BROWSER: 'none' };

  const { env = opts.env, timeout = 1000, maxTimeout = 30000 } = opts;
  const childProcess = createProcess(config, args, env);
  childProcess.stdin.setEncoding('utf-8');

  let currentInputTimeout: NodeJS.Timeout;
  let killIOTimeout: NodeJS.Timeout;

  // Creates a loop to feed user inputs to the child process in order to get results from the tool
  // This code is heavily inspired from inquirer-test:
  // https://github.com/ewnd9/inquirer-test/blob/6e2c40bbd39a061d3e52a8b1ee52cdac88f8d7f7/index.js#L14
  const loopInputs = (inputs: unknown[]) => {
    if (killIOTimeout) {
      clearTimeout(killIOTimeout);
    }

    if (!inputs.length) {
      childProcess.stdin.end();

      // Set a timeout to wait for CLI response. If CLI takes longer than
      // maxTimeout to respond, kill the childProcess and notify user
      killIOTimeout = setTimeout(() => {
        console.error('Error: Reached I/O timeout');
        childProcess.kill(constants.signals.SIGTERM);
      }, maxTimeout);

      return;
    }

    currentInputTimeout = setTimeout(async () => {
      if (typeof inputs[0] === 'function') {
        await inputs[0]();
      } else {
        childProcess.stdin.write(inputs[0]);
      }

      if (config.debug) {
        console.log('input:', inputs[0]);
      }

      loopInputs(inputs.slice(1));
    }, timeout);
  };

  // Get errors from CLI for debugging
  childProcess.stderr.on('data', (err: unknown) => {
    if (config.debug) {
      console.log('error:', err.toString());
    }
  });

  // Get output from CLI for debugging
  childProcess.stdout.on('data', (data: unknown) => {
    if (config.debug) {
      console.log('output:', data.toString());
    }
  });

  const promise = new Promise((resolve, reject) => {
    const handleStderr = (err: unknown) => {
      // Ignore any allowed errors so tests can continue
      const allowedErrors = [
        'DeprecationWarning', // Ignore package deprecation warnings.
        '[WARNING]', // Ignore our own CLI warning messages
      ];

      const error = err.toString();
      if (allowedErrors.some(s => error.includes(s))) {
        if (config.debug) {
          console.log('suppressed error:', error);
        }

        // Resubscribe if we ignored this error
        childProcess.stderr.once('data', handleStderr);
        return;
      }

      // If the childProcess errors out, stop all the pending inputs
      childProcess.stdin.end();

      if (currentInputTimeout) {
        clearTimeout(currentInputTimeout);
        inputs = [];
      }

      reject(error);
    };

    childProcess.stderr.once('data', handleStderr);
    childProcess.on('error', reject);

    childProcess.stdout.pipe(
      concat((result: unknown) => {
        if (killIOTimeout) {
          clearTimeout(killIOTimeout);
        }

        resolve(result.toString());
      })
    );
  });

  // Kick off the input process
  loopInputs(inputs);

  // Appending the process to the promise, in order to
  // add additional parameters or behavior (such as IPC communication)
  // @ts-expect-error Non-existent field
  promise.attachedProcess = childProcess;

  return promise;
}

export function createCli(config: TestConfig): CLI {
  return {
    execute: (args: string[], inputs?: string[], opts?: {}) =>
      executeWithInput(config, args, inputs, opts),
  };
}
