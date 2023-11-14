const readline = require('readline');
const { logger, setLogLevel, LOG_LEVEL } = require('@hubspot/cli-lib/logger');

const handleExit = callback => {
  const terminationSignals = [
    'beforeExit',
    'SIGINT', // Terminal trying to interrupt (Ctrl + C)
    'SIGUSR1', // Start Debugger User-defined signal 1
    'SIGUSR2', // User-defined signal 2
    'uncaughtException',
    'SIGTERM', // Represents a graceful termination
    'SIGHUP', // Parent terminal has been closed
  ];
  let exitInProgress = false;

  terminationSignals.forEach(signal => {
    process.removeAllListeners(signal);

    process.on(signal, async () => {
      // Prevent duplicate exit handling
      if (!exitInProgress) {
        exitInProgress = true;
        const isSIGHUP = 'SIGHUP';

        // Prevent logs when terminal closes
        if (isSIGHUP) {
          setLogLevel(LOG_LEVEL.NONE);
        }

        logger.debug(`Attempting to gracefully exit. Triggered by ${signal}`);
        await callback({ isSIGHUP });
      }
    });
  });
};

const handleKeypress = callback => {
  readline.createInterface(process.stdin, process.stdout);
  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.removeAllListeners('keypress');

  process.stdin.on('keypress', (str, key) => {
    if (key) {
      callback(key);
    }
  });
};

module.exports = {
  handleExit,
  handleKeypress,
};
