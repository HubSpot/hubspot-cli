/**
 * Integration test helper
 * Author: Andrés Zorro <zorrodg@gmail.com>
 * Taken from https://gist.github.com/zorrodg/c349cf54a3f6d0a9ba62e0f4066f31cb
 */
import { CLI, TestConfig } from './types';
import { constants } from 'os';
import spawn from 'cross-spawn';
import concat from 'concat-stream';
import * as process from 'node:process';
import * as path from 'node:path';
import { testOutputDir } from './TestState';

const PATH = process.env.PATH;

export function createProcess(
  config: TestConfig,
  args: string[] = [],
  env = {}
) {
  let processCommand: string;
  const { useInstalled, cliPath, debug } = config;

  if (useInstalled) {
    processCommand = 'hs';
  } else {
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
      BROWSER: 'none', // Prevent the browser from opening when `open` is called
      preventAutoStart: false,
      PATH, // This is needed in order to get all the binaries in your current terminal
      npm_config_loglevel: 'silent', // suppress warnings
      ...env,
      GITHUB_TOKEN: config.githubToken,
    },
    stdio: [null, null, null, 'ipc'], // This enables interprocess communication (IPC)
    cwd: path.join(process.cwd(), testOutputDir),
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

  const { env, timeout = 1000, maxTimeout = 30000 } = opts;

  const childProcess = createProcess(config, args, env);
  (childProcess.stdin as any).setEncoding('utf-8');

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
      console.log('error:', String(err));
    }
  });

  // Get output from CLI for debugging
  childProcess.stdout.on('data', (data: unknown) => {
    if (config.debug) {
      console.log('output:', String(data));
    }
  });

  const promise = new Promise((resolve, reject) => {
    const handleStderr = (err: unknown) => {
      // Ignore any allowed errors so tests can continue
      const allowedErrors = [
        'DeprecationWarning', // Ignore package deprecation warnings.
        '[WARNING]', // Ignore our own CLI warning messages
      ];

      const error = String(err);
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

        resolve(String(result));
      }) as any
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

export function createCli(config: TestConfig, testConfigFileName: string): CLI {
  return {
    // For commands that do not interface with the config file
    execute: (args: string[], inputs?: string[], opts?: {}) =>
      executeWithInput(config, args, inputs, opts),
    // For commands that interface with the config file
    executeWithTestConfig: (args: string[], inputs?: string[], opts?: {}) =>
      executeWithInput(
        config,
        [...args, `--c="${testConfigFileName}"`],
        inputs,
        opts
      ),
  };
}
