/**
 * Integration test helper
 * Author: Andrés Zorro <zorrodg@gmail.com>
 * Taken from https://gist.github.com/zorrodg/c349cf54a3f6d0a9ba62e0f4066f31cb
 */

const { existsSync } = require('fs');
const { constants } = require('os');
const spawn = require('cross-spawn');
const concat = require('concat-stream');
const PATH = process.env.PATH;

/**
 * Creates a child process with script path
 * @param {string} cliPath Path of the CLI process to execute
 * @param {string} cliVersion NPM Version number
 * @param {Array} args Arguments to the command
 * @param {Object} env (optional) Environment variables
 */
function createProcess(cliPath, cliVersion, args = [], env = null) {
  let processCommand;

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

  // This works for node based CLIs, but can easily be adjusted to
  // any other process installed in the system
  return spawn(processCommand, args, {
    env: Object.assign(
      {
        NODE_ENV: 'test',
        preventAutoStart: false,
        PATH, // This is needed in order to get all the binaries in your current terminal
      },
      env
    ),
    stdio: [null, null, null, 'ipc'], // This enables interprocess communication (IPC)
  });
}

/**
 * Creates a command and executes inputs (user responses) to the stdin
 * Returns a promise that resolves when all inputs are sent
 * Rejects the promise if any error
 * @param {string} processPath Path of the process to execute
 * @param {Array} args Arguments to the command
 * @param {Array} inputs (Optional) Array of inputs (user responses)
 * @param {Object} opts (optional) Environment variables
 */
function executeWithInput(
  cliPath,
  cliVersion,
  args = [],
  inputs = [],
  opts = {}
) {
  if (!Array.isArray(inputs)) {
    opts = inputs;
    inputs = [];
  }

  if (global.config.headless) {
    opts.env = { BROWSER: 'none' };
  }

  const { env = opts.env, timeout = 500, maxTimeout = 10000 } = opts;
  const childProcess = createProcess(cliPath, cliVersion, args, env);
  childProcess.stdin.setEncoding('utf-8');

  let currentInputTimeout, killIOTimeout;

  // Creates a loop to feed user inputs to the child process in order to get results from the tool
  // This code is heavily inspired from inquirer-test:
  // https://github.com/ewnd9/inquirer-test/blob/6e2c40bbd39a061d3e52a8b1ee52cdac88f8d7f7/index.js#L14
  const loopInputs = inputs => {
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

      if (global.config.debug) {
        console.log('input:', inputs[0]);
      }

      loopInputs(inputs.slice(1));
    }, timeout);
  };

  // Get errors from CLI for debugging
  childProcess.stderr.on('data', err => {
    if (global.config.debug) {
      console.log('error:', err.toString());
    }
  });

  // Get output from CLI for debugging
  childProcess.stdout.on('data', data => {
    if (global.config.debug) {
      console.log('output:', data.toString());
    }
  });

  const promise = new Promise((resolve, reject) => {
    const handleStderr = err => {
      // Ignore any allowed errors so tests can continue
      const allowedErrors = [
        'Loading available API samples', // When we use 'ora' it is throwing the loading error
        'DeprecationWarning', // Ignore package deprecation warnings.
        '[WARNING]', // Ignore our own CLI warning messages
      ];

      const error = err.toString();
      if (allowedErrors.some(s => error.includes(s))) {
        if (global.config.debug) {
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
      concat(result => {
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
  promise.attachedProcess = childProcess;

  return promise;
}

module.exports = {
  createProcess,
  createCli: (cliPath, cliVersion) => ({
    execute: (...args) => executeWithInput(cliPath, cliVersion, ...args),
  }),
  DOWN: '\x1B\x5B\x42',
  UP: '\x1B\x5B\x41',
  ENTER: '\x0D',
  SPACE: '\x20',
};
